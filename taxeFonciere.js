// Estimation APPROXIMATIVE de la taxe foncière annuelle, quand l'annonce ne la mentionne pas.
//
// Il n'existe pas d'API publique donnant le montant exact par bien : le calcul réel dépend
// de la "valeur locative cadastrale" de CHAQUE logement (donnée fiscale non publique).
// On applique donc la formule officielle (valeur locative × 50% × taux communal) avec des
// valeurs MOYENNES par taille de commune (sources : DGFiP, simulateurs spécialisés, 2026).
//
// Cette estimation est volontairement présentée comme "grossière" dans l'interface :
// l'écart avec la réalité peut facilement atteindre 30-40%. Pour un chiffre exact,
// il faut se référer à l'avis d'imposition du vendeur ou à impots.gouv.fr.

const TIERS = [
  // Paris intra-muros : valeur locative élevée, mais taux communal historiquement bas
  { test: (ville, pop) => /^paris$/i.test((ville || "").trim()), vlcM2: 95, tauxPct: 20 },
  // Grandes villes (+ de 250 000 habitants)
  { test: (ville, pop) => pop >= 250000, vlcM2: 65, tauxPct: 45 },
  // Villes moyennes (30 000 à 250 000 habitants)
  { test: (ville, pop) => pop >= 30000, vlcM2: 50, tauxPct: 45 },
  // Petites villes et communes rurales
  { test: (ville, pop) => true, vlcM2: 35, tauxPct: 50 }
];

/**
 * Estime la taxe foncière annuelle à partir de la surface et de la taille de la commune.
 * @param {number} surface
 * @param {string} ville
 * @param {number} population
 * @returns {number|null}
 */
export function estimateTaxeFonciere(surface, ville, population) {
  if (!surface || surface <= 0) return null;

  const tier = TIERS.find((t) => t.test(ville, population || 0));
  const valeurLocativeAnnuelle = surface * tier.vlcM2;
  const baseImposable = valeurLocativeAnnuelle * 0.5; // abattement forfaitaire légal de 50%
  const taxeAnnuelle = baseImposable * (tier.tauxPct / 100);

  return Math.round(taxeAnnuelle);
}
