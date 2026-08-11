import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // DOIT être EN PREMIER

import { extractListingFromUrl } from "./extractListing.js";
import { getSectorStats } from "./dvf.js";
import { estimateRent } from "./rent.js";
import { getCommuneInfo } from "./geo.js";
import { getCityImage } from "./cityImage.js";
import { estimateTaxeFonciere } from "./taxeFonciere.js";
import { estimateAssurancePNO } from "./assurance.js";
import { computeFullMetrics, TAUX_CREDIT_DEFAUT, TAUX_ASSURANCE_EMPRUNTEUR_DEFAUT } from "./calc.js";
import { extractPlanRooms } from "./planExtract.js";
import { computeTotalTravaux } from "./travauxPrix.js";
import { readListings, addListing, updateListing, deleteListing } from "./storage.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" })); // les plans (images/PDF) peuvent être volumineux
app.use(express.static("."));

// Champs financiers pour lesquels on retient l'origine de la valeur (annonce / estimation /
// manquant / manuel), afin que l'interface puisse signaler en rouge ce qui reste à vérifier.
const TRACKED_FIELDS = ["taxeFonciereAnnuelle", "chargesCoproMensuelles", "assurancePNO"];

app.get("/status", (req, res) => {
  res.json({ status: "AxIA backend en ligne" });
});

app.get("/api/listings", async (req, res) => {
  try {
    const listings = await readListings();
    res.json({ listings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de lire les analyses sauvegardées.", details: err.message });
  }
});

// Récupère une seule analyse (utilisé par la page Travaux)
app.get("/api/listings/:id", async (req, res) => {
  try {
    const listings = await readListings();
    const entry = listings.find((l) => l.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Analyse introuvable." });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de lire cette analyse.", details: err.message });
  }
});

app.delete("/api/listings/:id", async (req, res) => {
  try {
    const listings = await deleteListing(req.params.id);
    res.json({ listings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de supprimer cette analyse.", details: err.message });
  }
});

// Met à jour n'importe quel champ (listing et/ou projet financier), recalcule tout,
// et marque automatiquement "manuel" tout champ suivi que l'utilisateur vient de modifier.
app.patch("/api/listings/:id", async (req, res) => {
  try {
    const { listing: listingChanges, project: projectChanges, label } = req.body;

    const listings = await readListings();
    const entry = listings.find((l) => l.id === req.params.id);
    if (!entry) {
      return res.status(404).json({ error: "Analyse introuvable." });
    }

    const mergedListing = { ...entry.listing, ...(listingChanges || {}) };
    const mergedProject = { ...entry.project, ...(projectChanges || {}) };
    mergedProject.sources = { ...(entry.project.sources || {}) };

    if (projectChanges) {
      for (const key of Object.keys(projectChanges)) {
        if (TRACKED_FIELDS.includes(key)) mergedProject.sources[key] = "manuel";
      }
    }

    const financials = computeFullMetrics({ listing: mergedListing, sector: entry.sector, project: mergedProject });

    const updated = await updateListing(req.params.id, {
      listing: mergedListing,
      project: mergedProject,
      financials,
      ...(label !== undefined ? { label } : {})
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de mettre à jour cette analyse.", details: err.message });
  }
});

// Reçoit un plan (image ou PDF, encodé en base64), le fait lire par l'IA pour en extraire
// les pièces déjà cotées, et sauvegarde le tout sur l'analyse.
app.post("/api/listings/:id/plan", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: "Merci de fournir un plan (image ou PDF)." });
    }

    const listings = await readListings();
    const entry = listings.find((l) => l.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Analyse introuvable." });

    const pieces = await extractPlanRooms(imageBase64, mimeType);

    const travauxDetail = {
      ...(entry.project.travauxDetail || {}),
      planImageBase64: imageBase64,
      planMimeType: mimeType,
      pieces
    };

    const mergedProject = { ...entry.project, travauxDetail };
    const updated = await updateListing(req.params.id, { project: mergedProject });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de lire ce plan.", details: err.message });
  }
});

// Met à jour le chiffrage travaux (pièces + forfaits), recalcule le total,
// et répercute ce total sur le montant "Travaux" de l'analyse principale.
app.patch("/api/listings/:id/travaux", async (req, res) => {
  try {
    const { pieces, forfaits } = req.body;

    const listings = await readListings();
    const entry = listings.find((l) => l.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Analyse introuvable." });

    const { total, detail } = computeTotalTravaux({ pieces: pieces || [], forfaits: forfaits || {} });

    const travauxDetail = { ...(entry.project.travauxDetail || {}), pieces, forfaits, detail, total };
    const mergedProject = { ...entry.project, travauxDetail, travaux: total };
    mergedProject.sources = { ...(entry.project.sources || {}), travaux: "chiffrage" };

    const financials = computeFullMetrics({ listing: entry.listing, sector: entry.sector, project: mergedProject });

    const updated = await updateListing(req.params.id, { project: mergedProject, financials });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible d'enregistrer ce chiffrage.", details: err.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Merci de fournir une URL ou le texte d'une annonce." });
    }

    // Étape 1 : extraction IA
    const listing = await extractListingFromUrl(url);

    // Étape 2 : image (annonce ou ville)
    if (!listing.imageUrl && listing.ville) {
      listing.imageUrl = await getCityImage(listing.ville);
      listing.imageIsCity = !!listing.imageUrl;
    }

    // Étape 3 : infos de la commune (code INSEE + population, pour DVF/loyer/taxe foncière)
    const commune = await getCommuneInfo(listing.ville, listing.code_postal);
    const codeInsee = commune?.code || null;

    // Étape 4 : comparaison marché (DVF)
    const sector = codeInsee ? await getSectorStats(listing) : null;

    // Étape 5 : estimation du loyer
    let estimatedRent = null, rentFiable = null;
    if (codeInsee) {
      const estimation = await estimateRent(listing, codeInsee);
      if (estimation) { estimatedRent = estimation.loyerEstime; rentFiable = estimation.fiable; }
    }

    // Étape 6 : taxe foncière — priorité à l'annonce, sinon estimation grossière, sinon manquant
    const sources = {};
    let taxeFonciereAnnuelle = listing.taxe_fonciere_annuelle || null;
    if (taxeFonciereAnnuelle) {
      sources.taxeFonciereAnnuelle = "annonce";
    } else {
      taxeFonciereAnnuelle = estimateTaxeFonciere(listing.surface, listing.ville, commune?.population);
      sources.taxeFonciereAnnuelle = taxeFonciereAnnuelle ? "estimation" : "manquant";
    }

    // Étape 7 : charges de copropriété — uniquement si mentionnées dans l'annonce (pas d'auto-estimation fiable possible)
    const chargesCoproMensuelles = listing.charges_copro_mensuelles || null;
    sources.chargesCoproMensuelles = chargesCoproMensuelles ? "annonce" : "manquant";

    // Étape 8 : assurance PNO — estimée automatiquement selon le type de bien et la surface
    const assurancePNO = estimateAssurancePNO(listing.surface, listing.type_bien);
    sources.assurancePNO = assurancePNO ? "estimation" : "manquant";

    // Étape 9 : paramètres financiers par défaut (tous modifiables ensuite)
    const project = {
      monthlyRent: estimatedRent || 0,
      rentEstimated: !!estimatedRent,
      rentFiable,
      travaux: 0,
      fraisNotaire: listing.prix ? Math.round(listing.prix * 0.075) : 0,
      taxeFonciereAnnuelle,
      chargesCoproMensuelles,
      assurancePNO: assurancePNO || 0,
      gestionMensuelle: 0,
      tauxCredit: TAUX_CREDIT_DEFAUT,
      tauxAssuranceEmprunteur: TAUX_ASSURANCE_EMPRUNTEUR_DEFAUT,
      sources
    };

    // Étape 10 : calcul complet
    const financials = computeFullMetrics({ listing, sector, project });

    // Étape 11 : nom court par défaut
    const label = [listing.type_bien, listing.ville, listing.surface ? `${listing.surface}m²` : null]
      .filter(Boolean).join(" ") || "Annonce sans nom";

    const saved = await addListing({ listing, sector, project, financials, label });
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Une erreur est survenue pendant l'analyse.", details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AxIA backend démarré sur http://localhost:${PORT}`);
});
