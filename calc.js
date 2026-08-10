// Ce module calcule tous les indicateurs financiers d'un projet d'investissement :
// coût total, charges, mensualité de crédit, rentabilité brute/nette, cash-flow, score.

// Taux de crédit immobilier moyen en France sur 25 ans, à titre de valeur par défaut
// (sources : Pretto, CAFPI, Meilleurtaux — août 2026). Modifiable par annonce dans l'interface.
export const TAUX_CREDIT_DEFAUT = 3.45;
const DUREE_CREDIT_ANNEES = 25;

/**
 * Calcule la mensualité d'un prêt à taux fixe (formule d'amortissement classique).
 */
export function computeMensualite(capital, tauxAnnuelPct, dureeAnnees = DUREE_CREDIT_ANNEES) {
  if (!capital || capital <= 0) return 0;
  const tauxMensuel = (tauxAnnuelPct / 100) / 12;
  const n = dureeAnnees * 12;
  if (tauxMensuel === 0) return Math.round(capital / n);
  const mensualite = (capital * tauxMensuel * Math.pow(1 + tauxMensuel, n)) / (Math.pow(1 + tauxMensuel, n) - 1);
  return Math.round(mensualite);
}

/**
 * Calcule tous les indicateurs financiers d'une analyse : coût total du projet,
 * charges, mensualité de crédit, rentabilité brute et nette, cash-flow, score global.
 *
 * @param {object} listing - infos du bien (prix, surface...)
 * @param {object|null} sector - stats DVF du secteur (min/moyenne/max au m²)
 * @param {object} project - paramètres financiers saisis par l'investisseur
 */
export function computeFullMetrics({ listing, sector, project }) {
  const prix = listing.prix || 0;
  const surface = listing.surface || 0;
  const prixM2 = surface ? Math.round(prix / surface) : null;

  const travaux = project.travaux || 0;
  const fraisNotaire = project.fraisNotaire || 0;
  const totalProjet = prix + travaux + fraisNotaire;

  const loyerMensuel = project.monthlyRent || 0;
  const loyerAnnuel = loyerMensuel * 12;

  const chargesTotalMensuel =
    (project.taxeFonciereMensuel || 0) +
    (project.chargesMensuelles || 0) +
    (project.assurancePNO || 0) +
    (project.gestionMensuelle || 0);
  const chargesTotalAnnuel = chargesTotalMensuel * 12;

  const tauxCredit = project.tauxCredit ?? TAUX_CREDIT_DEFAUT;
  const creditMensuel = computeMensualite(totalProjet, tauxCredit);

  const rentabiliteBrut = totalProjet > 0 ? +((loyerAnnuel / totalProjet) * 100).toFixed(2) : null;
  const rentabiliteNette = totalProjet > 0 ? +(((loyerAnnuel - chargesTotalAnnuel) / totalProjet) * 100).toFixed(2) : null;
  const cashFlowMensuel = Math.round(loyerMensuel - chargesTotalMensuel - creditMensuel);

  const ecartMarche = sector && prixM2 ? +(((prixM2 - sector.avg) / sector.avg) * 100).toFixed(1) : null;

  // Score global sur 100 : combine rentabilité nette, cash-flow, et écart au marché.
  // Base neutre à 50, ajustée par ces trois facteurs. À affiner selon vos propres critères.
  let score = 50;
  if (rentabiliteNette !== null) score += Math.max(-25, Math.min(30, rentabiliteNette * 3));
  score += cashFlowMensuel >= 0 ? 10 : -15;
  if (ecartMarche !== null) score += Math.max(-15, Math.min(15, -ecartMarche / 2));
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    prixM2,
    totalProjet,
    loyerAnnuel,
    chargesTotalMensuel,
    chargesTotalAnnuel,
    creditMensuel,
    rentabiliteBrut,
    rentabiliteNette,
    cashFlowMensuel,
    ecartMarche,
    score
  };
}
