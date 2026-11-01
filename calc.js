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
export const APPORT_PCT_DEFAUT = 10; // % du coût total du projet, réglable dans Réglages

/**
 * L'apport est-il saisi à la main pour ce bien ? Sinon il suit le pourcentage par défaut.
 * Les anciennes analyses (sans marqueur) dont l'apport est > 0 sont considérées comme saisies.
 */
export function isApportManuel(project) {
  const src = project.sources?.apport;
  if (src === "manuel") return true;
  if (src === "auto") return false;
  return (project.apport || 0) > 0;
}

// ---------- Colocation ----------
// Loyer moyen d'une chambre en colocation, par ville. Source : baromètre Studapart,
// 1er semestre 2026 (annonces de chambres, à ~99 % meublées, proches des universités).
// Les villes ajoutées ou corrigées dans Réglages passent avant ce tableau.
export const LOYERS_COLOC_DEFAUT = [
  { ville: "Paris", loyer: 823, source: "Studapart S1 2026" },
  { ville: "Nice", loyer: 656, source: "Studapart S1 2026" },
  { ville: "Bordeaux", loyer: 549, source: "Studapart S1 2026" },
  { ville: "Marseille", loyer: 496, source: "Studapart S1 2026" },
  { ville: "Lyon", loyer: 485, source: "Studapart S1 2026" },
  { ville: "Nantes", loyer: 441, source: "Studapart S1 2026" },
  { ville: "Toulouse", loyer: 440, source: "Studapart S1 2026" },
  { ville: "Lille", loyer: 433, source: "Studapart S1 2026" },
  { ville: "Rennes", loyer: 417, source: "Studapart S1 2026" }
];
// Sans tarif connu pour la ville : loyer du bien entier majoré de 20 %, réparti par chambre.
// Ordre de grandeur seulement (affiché « peu fiable »).
export const PRIME_COLOC_ESTIMATION = 1.2;

export function normVille(v) {
  return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b\d+(e|er|eme)?\b/g, "").replace(/arrondissement/g, "").replace(/[^a-z]+/g, " ").trim();
}
export function loyerColocVille(ville, table) {
  const n = normVille(ville);
  if (!n) return null;
  return (table || []).find((t) => normVille(t.ville) === n) || null;
}
export function chambresParDefaut(listing) {
  if (listing.chambres > 0) return listing.chambres;
  if (listing.pieces > 1) return listing.pieces - 1; // T3 → 2 chambres (séjour exclu)
  return null;
}

export function computeFullMetrics({ listing, sector, project, apportPctDefaut = APPORT_PCT_DEFAUT, loyersColoc = LOYERS_COLOC_DEFAUT }) {
  const prix = listing.prix || 0;
  const surface = listing.surface || 0;
  const prixM2 = surface ? Math.round(prix / surface) : null;

  const travaux = project.travaux || 0;
  const fraisNotaire = project.fraisNotaire || 0;
  const totalProjet = prix + travaux + fraisNotaire;

  // Mode de location : entier, colocation, ou les deux (on retient alors celui choisi)
  const loc = project.location || {};
  const modeEntier = loc.entier !== false;
  const modeColoc = !!loc.coloc;
  const retenu = modeColoc && (!modeEntier || loc.retenu === "coloc") ? "coloc" : "entier";

  const loyerEntier = project.monthlyRent || 0;
  let coloc = null;
  if (modeColoc) {
    const chambres = loc.chambres > 0 ? Math.round(loc.chambres) : chambresParDefaut(listing);
    const villeTarif = loyerColocVille(listing.ville, loyersColoc);
    let loyerChambre = null, source = null, sourceDetail = null;
    if (loc.loyerChambre > 0) { loyerChambre = loc.loyerChambre; source = "manuel"; }
    else if (villeTarif) { loyerChambre = villeTarif.loyer; source = "ville"; sourceDetail = villeTarif.source || null; }
    else if (loyerEntier > 0 && chambres) { loyerChambre = Math.round(loyerEntier * PRIME_COLOC_ESTIMATION / chambres); source = "estimation"; }
    coloc = {
      chambres: chambres || null,
      chambresAuto: !(loc.chambres > 0),
      loyerChambre,
      source,
      sourceDetail,
      chargesMensuelles: loc.chargesColoc || 0,
      chargesManquantes: loc.chargesColoc == null,
      loyerMensuel: chambres && loyerChambre ? chambres * loyerChambre : 0
    };
  }

  const loyerMensuel = retenu === "coloc" ? coloc.loyerMensuel : loyerEntier;
  const loyerAnnuel = loyerMensuel * 12;
  // Charges propres à la colocation (énergie, internet, eau… souvent incluses dans le loyer d'une chambre)
  const chargesColocMensuelles = retenu === "coloc" ? coloc.chargesMensuelles : 0;

  // Anciennes analyses : taxe foncière mensuelle et "charges" génériques
  const taxeFonciereAnnuelle = project.taxeFonciereAnnuelle ?? (project.taxeFonciereMensuel != null ? project.taxeFonciereMensuel * 12 : 0);
  const chargesCopro = project.chargesCoproMensuelles ?? project.chargesMensuelles ?? 0;
  const taxeFonciereMensuelle = (taxeFonciereAnnuelle || 0) / 12;
  const chargesTotalMensuel =
    taxeFonciereMensuelle +
    (chargesCopro || 0) +
    (project.assurancePNO || 0) +
    (project.gestionMensuelle || 0) +
    chargesColocMensuelles;
  const chargesTotalAnnuel = chargesTotalMensuel * 12;

  // Apport personnel : par défaut un pourcentage du coût total, sinon le montant saisi pour ce bien
  const apportAuto = !isApportManuel(project);
  const apportPct = apportPctDefaut ?? APPORT_PCT_DEFAUT;
  const apportBrut = apportAuto ? Math.round(totalProjet * apportPct / 100) : (project.apport || 0);
  const apport = Math.max(0, Math.min(apportBrut, totalProjet));
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

  const ecartMarche = sector?.avg > 0 && prixM2 ? +(((prixM2 - sector.avg) / sector.avg) * 100).toFixed(1) : null;

  // Score global sur 100 : rentabilité nette (jusqu'à 30 pts), signe du cash-flow (±10-15 pts),
  // position par rapport au marché du secteur (jusqu'à ±15 pts). Base neutre à 50.
  let score = 50;
  if (rentabiliteNette !== null) score += Math.max(-25, Math.min(30, rentabiliteNette * 3));
  score += cashFlowMensuel >= 0 ? 10 : -15;
  if (ecartMarche !== null) score += Math.max(-15, Math.min(15, -ecartMarche / 2));
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Scénario non retenu, pour comparer (uniquement si les deux modes sont cochés)
  let alternative = null;
  if (modeEntier && modeColoc) {
    const altColoc = retenu === "entier";
    const altLoyer = altColoc ? coloc.loyerMensuel : loyerEntier;
    const altCharges = chargesTotalMensuel - chargesColocMensuelles + (altColoc ? coloc.chargesMensuelles : 0);
    alternative = {
      mode: altColoc ? "coloc" : "entier",
      loyerMensuel: altLoyer,
      rentabiliteNette: totalProjet > 0 ? +((((altLoyer - altCharges) * 12) / totalProjet) * 100).toFixed(2) : null,
      cashFlowMensuel: Math.round(altLoyer - altCharges - creditMensuel - assuranceEmprunteurMensuelle)
    };
  }

  return {
    prixM2,
    modeLocation: retenu,
    loyerMensuel,
    coloc,
    chargesColocMensuelles,
    alternative,
    totalProjet,
    apport,
    apportAuto,
    apportPct: apportAuto ? apportPct : null,
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
