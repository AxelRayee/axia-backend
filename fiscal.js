// Simulateur fiscal — compare les régimes d'imposition applicables selon que le bien
// est loué nu (revenus fonciers) ou meublé (BIC / LMNP).
//
// Taux et seuils en vigueur (sources : impots.gouv.fr, LFSS 2026 — situation août 2026) :
// - Prélèvements sociaux : 18,6% (relevés depuis le 1er janvier 2026, LFSS 2026 art.12)
// - Micro-foncier : abattement 30%, plafond 15 000€/an de loyers bruts
// - Micro-BIC (location meublée longue durée classique) : abattement 50%, plafond ~77 700€/an
// - Réel foncier : déficit imputable sur le revenu global plafonné à 10 700€/an
// - LMNP réel : amortissement du bien (hors terrain) + travaux, déficit non imputable
//   sur le revenu global (uniquement reportable sur les bénéfices LMNP futurs)
//
// IMPORTANT : ce simulateur donne une photo de l'année 1, pas une simulation
// pluriannuelle (report de déficit les années suivantes, plus-value à la revente).
// Pour du LMNP réel en particulier, un comptable spécialisé reste recommandé.

export const PS_RATE = 18.6; // %
export const SEUIL_MICRO_FONCIER = 15000;
export const SEUIL_MICRO_BIC = 77700;

/**
 * Estime la part d'intérêts payée la première année d'un crédit (approximation
 * raisonnable pour un prêt amortissable classique : intérêts ≈ capital × taux).
 */
function estimateInteretsAnnee1(capitalEmprunte, tauxAnnuelPct) {
  return Math.round(capitalEmprunte * (tauxAnnuelPct / 100));
}

/**
 * Location NUE — régime micro-foncier
 */
function computeMicroFoncier(loyerAnnuel, tmi) {
  const eligible = loyerAnnuel <= SEUIL_MICRO_FONCIER;
  const base = Math.round(loyerAnnuel * 0.7); // abattement 30%
  const impot = Math.round(base * (tmi / 100));
  const ps = Math.round(base * (PS_RATE / 100));
  return { regime: "Micro-foncier", eligible, baseImposable: base, impot, prelevementsSociaux: ps, total: impot + ps };
}

/**
 * Location NUE — régime réel foncier
 */
function computeReelFoncier({ loyerAnnuel, chargesHorsInterets, capitalEmprunte, tauxCredit, tmi }) {
  const interets = estimateInteretsAnnee1(capitalEmprunte, tauxCredit);
  const baseAvantDeficit = loyerAnnuel - chargesHorsInterets - interets;

  let baseImposable = 0, impot = 0, ps = 0, deficitImputable = 0, deficitReporte = 0, economieDeficit = 0;

  if (baseAvantDeficit >= 0) {
    baseImposable = baseAvantDeficit;
    impot = Math.round(baseImposable * (tmi / 100));
    ps = Math.round(baseImposable * (PS_RATE / 100));
  } else {
    const deficitHorsInterets = Math.max(0, chargesHorsInterets - loyerAnnuel);
    deficitImputable = Math.min(10700, deficitHorsInterets);
    deficitReporte = -baseAvantDeficit - deficitImputable;
    economieDeficit = Math.round(deficitImputable * (tmi / 100)); // économie d'impôt sur le revenu global cette année
  }

  return {
    regime: "Réel foncier", eligible: true, baseImposable, impot, prelevementsSociaux: ps,
    deficitImputableGlobal: deficitImputable, deficitReporte, economieDeficit,
    total: impot + ps - economieDeficit
  };
}

/**
 * Location MEUBLÉE — régime micro-BIC
 */
function computeMicroBIC(loyerAnnuel, tmi) {
  const eligible = loyerAnnuel <= SEUIL_MICRO_BIC;
  const base = Math.round(loyerAnnuel * 0.5); // abattement 50%
  const impot = Math.round(base * (tmi / 100));
  const ps = Math.round(base * (PS_RATE / 100));
  return { regime: "Micro-BIC", eligible, baseImposable: base, impot, prelevementsSociaux: ps, total: impot + ps };
}

/**
 * Location MEUBLÉE — régime réel (LMNP réel), avec amortissement
 */
function computeLmnpReel({ loyerAnnuel, chargesHorsInterets, capitalEmprunte, tauxCredit, tmi, totalProjet, travaux, partTerrainPct, dureeAmortImmeubleAns, dureeAmortTravauxAns }) {
  const interets = estimateInteretsAnnee1(capitalEmprunte, tauxCredit);

  const baseAmortissableImmeuble = (totalProjet - travaux) * (1 - partTerrainPct / 100);
  const amortImmeuble = Math.round(baseAmortissableImmeuble / dureeAmortImmeubleAns);
  const amortTravaux = travaux > 0 ? Math.round(travaux / dureeAmortTravauxAns) : 0;
  const amortissementAnnuel = amortImmeuble + amortTravaux;

  const resultatAvantAmort = loyerAnnuel - chargesHorsInterets - interets;
  const resultat = resultatAvantAmort - amortissementAnnuel;

  const baseImposable = Math.max(0, resultat);
  const impot = Math.round(baseImposable * (tmi / 100));
  const ps = Math.round(baseImposable * (PS_RATE / 100));
  const deficitReporteNonUtilise = resultat < 0 ? Math.round(-resultat) : 0;

  return {
    regime: "LMNP réel", eligible: true, baseImposable, impot, prelevementsSociaux: ps,
    amortissementAnnuel, deficitReporteNonUtilise, total: impot + ps
  };
}

/**
 * Calcule et compare les régimes applicables selon le mode de location (nu/meublé).
 */
export function computeComparaisonFiscale({ listing, project, financials, profilFiscal, modeLocation }) {
  const loyerAnnuel = financials.loyerAnnuel || 0;
  const chargesHorsInterets =
    (project.taxeFonciereAnnuelle || 0) +
    (project.chargesCoproMensuelles || 0) * 12 +
    (project.assurancePNO || 0) * 12 +
    (financials.assuranceEmprunteurMensuelle || 0) * 12 +
    (project.gestionMensuelle || 0) * 12;

  const capitalEmprunte = financials.capitalEmprunte ?? financials.totalProjet ?? 0;
  const tauxCredit = project.tauxCredit || 0;
  const tmi = profilFiscal.tmi;

  let regimes = [];
  if (modeLocation === "nu") {
    regimes = [
      computeMicroFoncier(loyerAnnuel, tmi),
      computeReelFoncier({ loyerAnnuel, chargesHorsInterets, capitalEmprunte, tauxCredit, tmi })
    ];
  } else {
    regimes = [
      computeMicroBIC(loyerAnnuel, tmi),
      computeLmnpReel({
        loyerAnnuel, chargesHorsInterets, capitalEmprunte, tauxCredit, tmi,
        totalProjet: financials.totalProjet || 0,
        travaux: project.travaux || 0,
        partTerrainPct: profilFiscal.partTerrainPct,
        dureeAmortImmeubleAns: profilFiscal.dureeAmortImmeubleAns,
        dureeAmortTravauxAns: profilFiscal.dureeAmortTravauxAns
      })
    ];
  }

  const cashFlowAnnuelAvantImpot = (financials.cashFlowMensuel || 0) * 12;
  for (const r of regimes) {
    r.cashFlowNetNetAnnuel = cashFlowAnnuelAvantImpot - r.total;
    r.cashFlowNetNetMensuel = Math.round(r.cashFlowNetNetAnnuel / 12);
  }

  const meilleur = [...regimes].sort((a, b) => b.cashFlowNetNetAnnuel - a.cashFlowNetNetAnnuel)[0];

  return { regimes, meilleurRegime: meilleur.regime, cashFlowAnnuelAvantImpot };
}
