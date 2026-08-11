// Base de prix indicatifs pour le chiffrage travaux, France, 2026.
// Sources : Fédération Française du Bâtiment (FFB), CAPEB, et moyennes de marché
// constatées par plusieurs professionnels du secteur (Groupe R, Mon Guide Rénovation,
// RénoEstim — données 2026). CE SONT DES FOURCHETTES MOYENNES, PAS DES DEVIS RÉELS :
// le prix final dépend de la région, de la qualité des matériaux et de l'état du bien.
// Toujours faire établir de vrais devis avant d'engager des travaux.

// --- Postes calculés au m² (appliqués à une pièce du plan) ---
export const PRIX_PAR_M2 = {
  peinture: { artisan: 45, fourniture: 8, base: "murs+plafond" },     // €/m², murs et plafond
  sol: { artisan: 75, fourniture: 25, base: "sol" },                   // €/m², moyenne carrelage/parquet flottant
  electricite: { artisan: 100, fourniture: 35, base: "sol" },          // €/m², mise aux normes NF C 15-100
  plomberie: { artisan: 80, fourniture: 25, base: "sol" }              // €/m², réseaux eau/évacuation
};

// --- Gros travaux, calculés au m² (surface habitable totale) ---
export const PRIX_GROS_TRAVAUX_M2 = {
  isolation: { artisan: 110, fourniture: 40 },
  toiture: { artisan: 130, fourniture: 50 },
  cloisons: { artisan: 120, fourniture: 40 } // ouverture/création de cloisons, saisie manuelle en m²
};

// --- Pièces à forfait (cuisine, salle de bain), par niveau de gamme ---
export const FORFAITS = {
  cuisine: {
    basique: { artisan: 4000, fourniture: 2500 },
    moyenne: { artisan: 8000, fourniture: 5000 },
    haut_de_gamme: { artisan: 15000, fourniture: 9000 }
  },
  salle_de_bain: {
    basique: { artisan: 5000, fourniture: 2800 },
    moyenne: { artisan: 8500, fourniture: 4700 },
    haut_de_gamme: { artisan: 14000, fourniture: 7700 }
  }
};

// --- Menuiseries (fenêtres/portes), prix à l'unité ---
export const PRIX_MENUISERIE_UNITE = { artisan: 650, fourniture: 350 };

/**
 * Calcule le coût d'une ligne "par m²" (peinture, sol, électricité, plomberie)
 * pour une pièce donnée, selon le choix artisan/fourniture.
 */
export function computeLignePiece(poste, piece, mode) {
  const ref = PRIX_PAR_M2[poste];
  if (!ref) return 0;
  const surface = ref.base === "murs+plafond"
    ? (piece.surfaceMurs || 0) + (piece.surfaceSol || 0)
    : (piece.surfaceSol || 0);
  const prixM2 = mode === "artisan" ? ref.artisan : ref.fourniture;
  return Math.round(surface * prixM2);
}

/**
 * Calcule le total de tous les postes d'un chiffrage travaux
 * (pièces du plan + forfaits + gros travaux + menuiseries).
 */
export function computeTotalTravaux({ pieces = [], forfaits = {} }) {
  let total = 0;
  const detail = [];

  // Postes par pièce
  for (const piece of pieces) {
    for (const poste of Object.keys(PRIX_PAR_M2)) {
      const choix = piece.postes?.[poste]; // "artisan" | "fourniture" | undefined (non sélectionné)
      if (!choix) continue;
      const cout = computeLignePiece(poste, piece, choix);
      total += cout;
      detail.push({ piece: piece.nom, poste, mode: choix, cout });
    }
  }

  // Cuisine
  if (forfaits.cuisine?.niveau) {
    const ref = FORFAITS.cuisine[forfaits.cuisine.niveau];
    const cout = ref ? ref[forfaits.cuisine.mode] || 0 : 0;
    total += cout;
    detail.push({ piece: "Cuisine", poste: "forfait", mode: forfaits.cuisine.mode, cout });
  }

  // Salle de bain
  if (forfaits.salle_de_bain?.niveau) {
    const ref = FORFAITS.salle_de_bain[forfaits.salle_de_bain.niveau];
    const cout = ref ? ref[forfaits.salle_de_bain.mode] || 0 : 0;
    total += cout;
    detail.push({ piece: "Salle de bain", poste: "forfait", mode: forfaits.salle_de_bain.mode, cout });
  }

  // Gros travaux (isolation, toiture, cloisons) — saisis en m² par l'utilisateur
  for (const poste of Object.keys(PRIX_GROS_TRAVAUX_M2)) {
    const item = forfaits[poste];
    if (!item?.mode || !item?.surfaceM2) continue;
    const ref = PRIX_GROS_TRAVAUX_M2[poste];
    const cout = Math.round(item.surfaceM2 * ref[item.mode]);
    total += cout;
    detail.push({ piece: poste, poste, mode: item.mode, cout });
  }

  // Menuiseries (fenêtres/portes), à l'unité
  if (forfaits.menuiseries?.quantite && forfaits.menuiseries?.mode) {
    const cout = Math.round(forfaits.menuiseries.quantite * PRIX_MENUISERIE_UNITE[forfaits.menuiseries.mode]);
    total += cout;
    detail.push({ piece: "Menuiseries", poste: "menuiseries", mode: forfaits.menuiseries.mode, cout });
  }

  return { total: Math.round(total), detail };
}
