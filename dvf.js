// Ce module interroge la base DVF+ (Cerema), qui liste les vraies transactions
// immobilières (ventes), pour comparer le prix d'une annonce au marché réel du secteur.
//
// ATTENTION : l'API DVF+ est encore en version bêta ("preprod" dans son adresse).
// Elle peut parfois être temporairement indisponible (erreur 502/503) - c'est un service
// public gratuit encore en développement, pas un service commercial avec garantie de disponibilité.
// Documentation à jour : https://apidf-preprod.cerema.fr/swagger/

import { getCodeInsee } from "./geo.js";

const DVF_BASE = "https://apidf-preprod.cerema.fr/dvf_opendata/mutations/";

/**
 * Calcule les statistiques de marché (prix bas / moyen / haut au m²) pour le secteur du bien.
 * Renvoie `null` si les données sont indisponibles, plutôt que de bloquer toute l'analyse.
 */
export async function getSectorStats(listing) {
  if (!listing.ville && !listing.code_postal) return null;

  try {
    const codeInsee = await getCodeInsee(listing.ville, listing.code_postal);
    if (!codeInsee) return null;

    const url = `${DVF_BASE}?code_insee=${codeInsee}&page_size=200`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`API DVF indisponible (statut ${response.status}) — analyse poursuivie sans comparaison marché.`);
      return null;
    }

    const data = await response.json();
    const mutations = data.results || data.features || [];

    const comparables = mutations
      .map((m) => ({
        valeur: m.valeurfonc ?? m.valeur_fonciere,
        surface: m.sbati ?? m.surface_reelle_bati
      }))
      .filter((m) => m.valeur && m.surface && m.surface > 9);

    if (comparables.length < 5) return null;

    const prixM2List = comparables
      .map((m) => m.valeur / m.surface)
      .sort((a, b) => a - b);

    const min = prixM2List[0];
    const max = prixM2List[prixM2List.length - 1];
    const avg = prixM2List.reduce((a, b) => a + b, 0) / prixM2List.length;

    return {
      min: Math.round(min),
      avg: Math.round(avg),
      max: Math.round(max),
      nbTransactions: comparables.length
    };
  } catch (e) {
    console.error("Erreur API DVF :", e.message);
    return null;
  }
}
