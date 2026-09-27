// Calcule tous les indicateurs financiers d'un projet d'investissement.

// Taux moyens du marché français (sources : Pretto, CAFPI, Meilleurtaux, Magnolia — août 2026).
// Modifiables par annonce dans l'interface.
export const TAUX_CREDIT_DEFAUT = 3.45;              // % annuel, crédit sur 25 ans
export const TAUX_ASSURANCE_EMPRUNTEUR_DEFAUT = 0.34; // % annuel du capital emprunté (TAEA moyen marché)
const DUREE_CREDIT_ANNEES = 25;

/**
 * Calcule la mensualité d'un prêt à taux fixe (hors assurance), formule d'amortissement classique.
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
 * Calcule tous les indicateurs financiers d'une analyse.
 *
 * IMPORTANT sur les conventions utilisées :
 * - La rentabilité (brute et nette) porte sur le bien lui-même : elle NE tient PAS compte
 *   du financement (crédit, assurance emprunteur). C'est la convention standard en immobilier,
 *   qui permet de comparer des biens indépendamment de la façon dont vous les financez.
 * - Le cash-flow, lui, tient compte de TOUT : c'est ce qu'il vous reste réellement en poche
 *   chaque mois, crédit et assurance emprunteur inclus.
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

  const taxeFonciereMensuelle = (project.taxeFonciereAnnuelle || 0) / 12;
  const chargesTotalMensuel =
    taxeFonciereMensuelle +
    (project.chargesCoproMensuelles || 0) +
    (project.assurancePNO || 0) +
    (project.gestionMensuelle || 0);
  const chargesTotalAnnuel = chargesTotalMensuel * 12;

  // Apport personnel : réduit le capital emprunté (0 par défaut = financement à 100 %)
  const apport = Math.max(0, Math.min(project.apport || 0, totalProjet));
  const capitalEmprunte = totalProjet - apport;

  const tauxCredit = project.tauxCredit ?? TAUX_CREDIT_DEFAUT;
  const creditMensuel = computeMensualite(capitalEmprunte, tauxCredit);

  const tauxAssuranceEmprunteur = project.tauxAssuranceEmprunteur ?? TAUX_ASSURANCE_EMPRUNTEUR_DEFAUT;
  const assuranceEmprunteurMensuelle = capitalEmprunte > 0
    ? Math.round(capitalEmprunte * (tauxAssuranceEmprunteur / 100) / 12)
    : 0;

  const rentabiliteBrut = totalProjet > 0 ? +((loyerAnnuel / totalProjet) * 100).toFixed(2) : null;
  const rentabiliteNette = totalProjet > 0 ? +(((loyerAnnuel - chargesTotalAnnuel) / totalProjet) * 100).toFixed(2) : null;

  const cashFlowMensuel = Math.round(loyerMensuel - chargesTotalMensuel - creditMensuel - assuranceEmprunteurMensuelle);

  const ecartMarche = sector && prixM2 ? +(((prixM2 - sector.avg) / sector.avg) * 100).toFixed(1) : null;

  // Score global sur 100 : rentabilité nette (jusqu'à 30 pts), signe du cash-flow (±10-15 pts),
  // position par rapport au marché du secteur (jusqu'à ±15 pts). Base neutre à 50.
  let score = 50;
  if (rentabiliteNette !== null) score += Math.max(-25, Math.min(30, rentabiliteNette * 3));
  score += cashFlowMensuel >= 0 ? 10 : -15;
  if (ecartMarche !== null) score += Math.max(-15, Math.min(15, -ecartMarche / 2));
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    prixM2,
    totalProjet,
    apport,
    capitalEmprunte,
    loyerAnnuel,
    chargesTotalMensuel,
    chargesTotalAnnuel,
    creditMensuel,
    assuranceEmprunteurMensuelle,
    rentabiliteBrut,
    rentabiliteNette,
    cashFlowMensuel,
    ecartMarche,
    score
  };
}
