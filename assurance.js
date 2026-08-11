// Estime le coût mensuel de l'assurance PNO (Propriétaire Non Occupant), en fonction
// du type de bien et de sa surface, à partir de tarifs moyens observés sur le marché
// français en 2026 (sources : comparateurs d'assurance — Selectra, GoodAssur, Qivio,
// AssurancesLabs — moyenne des fourchettes publiées mi-2026).
//
// Références utilisées : ~11€/mois pour un appartement type (50m²), ~18€/mois pour
// une maison type (90m²). Ajusté proportionnellement à la surface réelle du bien,
// dans une fourchette raisonnable pour éviter les estimations aberrantes.

const REFERENCES = {
  Appartement: { surfaceRef: 50, mensuelRef: 11 },
  Maison: { surfaceRef: 90, mensuelRef: 18 }
};

/**
 * Estime le coût mensuel de l'assurance PNO.
 * @param {number} surface
 * @param {string} typeBien - "Appartement" ou "Maison"
 * @returns {number|null}
 */
export function estimateAssurancePNO(surface, typeBien) {
  if (!surface || surface <= 0) return null;

  const ref = REFERENCES[typeBien] || REFERENCES.Appartement;
  const brut = ref.mensuelRef * (surface / ref.surfaceRef);
  const borne = Math.max(ref.mensuelRef * 0.5, Math.min(ref.mensuelRef * 2.5, brut));

  return Math.round(borne);
}
