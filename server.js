import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config(); // DOIT être EN PREMIER

import { extractListingFromUrl } from "./extractListing.js";
import { getSectorStats } from "./dvf.js";
import { estimateRent } from "./rent.js";
import { getCodeInsee } from "./geo.js";
import { getCityImage } from "./cityImage.js";
import { computeMetrics } from "./calc.js";
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

// Recalcule les métriques d'une analyse existante avec un loyer mensuel corrigé à la main
app.patch("/api/listings/:id/rent", async (req, res) => {
  try {
    const { monthlyRent } = req.body;
    if (monthlyRent === undefined || monthlyRent === null || isNaN(monthlyRent)) {
      return res.status(400).json({ error: "Merci de fournir un loyer mensuel valide." });
    }

    const listings = await readListings();
    const entry = listings.find((l) => l.id === req.params.id);
    if (!entry) {
      return res.status(404).json({ error: "Analyse introuvable." });
    }

    const metrics = computeMetrics({ listing: entry.listing, sector: entry.sector, monthlyRent });
    const updated = await updateListing(req.params.id, {
      metrics,
      rent: { ...entry.rent, monthlyRent, corrige: true }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de recalculer cette analyse.", details: err.message });
  }
});

// Route principale : reçoit une URL (ou texte) d'annonce, renvoie l'analyse complète ET la sauvegarde
app.post("/api/analyze", async (req, res) => {
  try {
    const { url, monthlyRent } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Merci de fournir une URL ou le texte d'une annonce." });
    }

    // Étape 1 : l'IA lit l'annonce et en extrait les informations structurées
    const listing = await extractListingFromUrl(url);

    // Si l'annonce ne fournissait pas d'image exploitable (texte collé, ou site sans aperçu),
    // on utilise une photo représentative de la ville à la place.
    if (!listing.imageUrl && listing.ville) {
      listing.imageUrl = await getCityImage(listing.ville);
      listing.imageIsCity = !!listing.imageUrl;
    }

    // Étape 2 : on trouve le code de la commune (réutilisé pour DVF et pour l'estimation de loyer)
    const codeInsee = await getCodeInsee(listing.ville, listing.code_postal);

    // Étape 3 : on compare au marché réel du secteur grâce aux données DVF
    const sector = codeInsee ? await getSectorStats(listing) : null;

    // Étape 4 : on estime automatiquement le loyer mensuel, sauf si l'utilisateur en a fourni un lui-même
    let rent = null;
    let effectiveRent = monthlyRent;
    if (codeInsee) {
      const estimation = await estimateRent(listing, codeInsee);
      if (estimation) {
        rent = { ...estimation, monthlyRent: monthlyRent || estimation.loyerEstime, corrige: !!monthlyRent };
        if (!monthlyRent) effectiveRent = estimation.loyerEstime;
      }
    }

    // Étape 5 : on calcule le rendement, l'écart au marché et un score global
    const metrics = computeMetrics({ listing, sector, monthlyRent: effectiveRent });

    // Étape 6 : on sauvegarde le résultat sur le disque, pour qu'il survive à la fermeture du navigateur
    const saved = await addListing({ listing, sector, metrics, rent });

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
