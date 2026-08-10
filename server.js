import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // DOIT être EN PREMIER

import { extractListingFromUrl } from "./extractListing.js";
import { getSectorStats } from "./dvf.js";
import { estimateRent } from "./rent.js";
import { getCodeInsee } from "./geo.js";
import { getCityImage } from "./cityImage.js";
import { computeFullMetrics, TAUX_CREDIT_DEFAUT } from "./calc.js";
import { readListings, addListing, updateListing, deleteListing } from "./storage.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Sert les fichiers statiques du dossier courant

// Route de test
app.get("/status", (req, res) => {
  res.json({ status: "AxIA backend en ligne" });
});

// Récupère toutes les analyses déjà sauvegardées (appelé au chargement de la page)
app.get("/api/listings", async (req, res) => {
  try {
    const listings = await readListings();
    res.json({ listings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de lire les analyses sauvegardées.", details: err.message });
  }
});

// Supprime une analyse sauvegardée
app.delete("/api/listings/:id", async (req, res) => {
  try {
    const listings = await deleteListing(req.params.id);
    res.json({ listings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de supprimer cette analyse.", details: err.message });
  }
});

// Met à jour n'importe quel champ (listing et/ou paramètres financiers du projet)
// d'une analyse existante, puis recalcule tous les indicateurs financiers.
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

// Route principale : reçoit une URL (ou texte) d'annonce, renvoie l'analyse complète ET la sauvegarde
app.post("/api/analyze", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Merci de fournir une URL ou le texte d'une annonce." });
    }

    // Étape 1 : l'IA lit l'annonce et en extrait les informations structurées
    const listing = await extractListingFromUrl(url);

    // Étape 2 : image de l'annonce, ou photo de la ville en remplacement
    if (!listing.imageUrl && listing.ville) {
      listing.imageUrl = await getCityImage(listing.ville);
      listing.imageIsCity = !!listing.imageUrl;
    }

    // Étape 3 : code commune (réutilisé pour DVF et estimation de loyer)
    const codeInsee = await getCodeInsee(listing.ville, listing.code_postal);

    // Étape 4 : comparaison au marché réel du secteur (DVF)
    const sector = codeInsee ? await getSectorStats(listing) : null;

    // Étape 5 : estimation automatique du loyer mensuel
    let estimatedRent = null;
    let rentFiable = null;
    if (codeInsee) {
      const estimation = await estimateRent(listing, codeInsee);
      if (estimation) {
        estimatedRent = estimation.loyerEstime;
        rentFiable = estimation.fiable;
      }
    }

    // Étape 6 : paramètres financiers par défaut du projet (tous modifiables ensuite)
    const project = {
      monthlyRent: estimatedRent || 0,
      rentEstimated: !!estimatedRent,
      rentFiable,
      travaux: 0,
      fraisNotaire: listing.prix ? Math.round(listing.prix * 0.075) : 0, // 7,5% (ancien), modifiable
      taxeFonciereMensuel: 0,
      chargesMensuelles: 0,
      assurancePNO: 0,
      gestionMensuelle: 0,
      tauxCredit: TAUX_CREDIT_DEFAUT
    };

    // Étape 7 : calcul de tous les indicateurs financiers
    const financials = computeFullMetrics({ listing, sector, project });

    // Étape 8 : un nom court par défaut pour identifier l'annonce dans le tableau
    const label = [listing.type_bien, listing.ville, listing.surface ? `${listing.surface}m²` : null]
      .filter(Boolean)
      .join(" ") || "Annonce sans nom";

    // Étape 9 : sauvegarde
    const saved = await addListing({ listing, sector, project, financials, label });

    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Une erreur est survenue pendant l'analyse.",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AxIA backend démarré sur http://localhost:${PORT}`);
});
