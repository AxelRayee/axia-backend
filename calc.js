/**
 * Calcule les indicateurs de rentabilité et un score global sur 100.
 * @param {object} listing - les données extraites de l'annonce (prix, surface, prixM2...)
 * @param {object|null} sector - les statistiques du secteur (min/moyenne/max au m²), ou null si indisponibles
 * @param {number|null} monthlyRent - le loyer mensuel estimé, fourni par l'investisseur
 */
export function computeMetrics({ listing, sector, monthlyRent }) {
  const result = {
    rendementBrut: null,
    ecartMarche: null,
    score: null
  };

  // Rendement brut = (loyers annuels / prix d'achat) x 100
  if (monthlyRent && listing.prix) {
    result.rendementBrut = +((monthlyRent * 12 / listing.prix) * 100).toFixed(2);
  }

  // Écart au marché = de combien le prix au m² du bien s'écarte de la moyenne du secteur
  if (sector && listing.prixM2) {
    result.ecartMarche = +(((listing.prixM2 - sector.avg) / sector.avg) * 100).toFixed(1);
  }

  // Score simple sur 100, à affiner selon vos propres critères d'investisseur.
  // Base neutre à 50, puis on ajuste selon le rendement et l'écart au marché.
  let score = 50;
  if (result.rendementBrut !== null) {
    score += Math.max(-20, Math.min(30, result.rendementBrut * 4));
  }
  if (result.ecartMarche !== null) {
    score += Math.max(-20, Math.min(20, -result.ecartMarche));
  }
  result.score = Math.max(0, Math.min(100, Math.round(score)));

  return result;
}
