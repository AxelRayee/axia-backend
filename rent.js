// Ce module estime le loyer mensuel probable d'un bien, à partir de la
// "Carte des loyers" — une base officielle et gratuite publiée par l'ANIL
// (Agence Nationale pour l'Information sur le Logement) et le Ministère du Logement,
// construite à partir de plusieurs millions d'annonces de location réelles.
//
// Source : https://www.data.gouv.fr/fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune
// Distribuée via une couche cartographique publique (Esri France) interrogeable librement.
//
// Important à savoir : c'est une ESTIMATION statistique par commune (loyer moyen au m²
// pour un bien "type"), pas le loyer exact de CE bien précis. Un bien avec des atouts
// particuliers (vue, étage, rénové...) peut se louer plus ou moins cher. D'où l'intérêt
// de garder la possibilité de corriger cette estimation à la main.

const RENT_LAYERS = {
  Appartement: "https://services.arcgis.com/d3voDfTFbHOCRwVR/ArcGIS/rest/services/Carte_des_loyers__Jan_2024_/FeatureServer/0",
  Maison: "https://services.arcgis.com/d3voDfTFbHOCRwVR/ArcGIS/rest/services/Carte_des_loyers__Jan_2024_/FeatureServer/1"
};

/**
 * Estime le loyer mensuel d'un bien à partir de sa ville et de sa surface.
 * @param {object} listing - doit contenir au minimum { code_postal ou ville, surface, type_bien }
 * @param {string} codeInsee - le code INSEE de la commune (déjà calculé ailleurs, pour éviter un double appel)
 * @returns {object|null} - { loyerM2, loyerEstime, fiabilite } ou null si indisponible
 */
export async function estimateRent(listing, codeInsee) {
  if (!codeInsee || !listing.surface) return null;

  const layerUrl = RENT_LAYERS[listing.type_bien] || RENT_LAYERS.Appartement;

  try {
    const params = new URLSearchParams({
      where: `INSEE_COM='${codeInsee}'`,
      outFields: "loypredm2,nbobs_com,R2_adj",
      f: "json"
    });
    const response = await fetch(`${layerUrl}/query?${params.toString()}`);

    if (!response.ok) {
      console.error(`API Carte des loyers indisponible (statut ${response.status}).`);
      return null;
    }

    const data = await response.json();
    const feature = data.features?.[0]?.attributes;
    if (!feature || !feature.loypredm2) return null;

    const loyerM2 = feature.loypredm2;
    const loyerEstime = Math.round(loyerM2 * listing.surface);

    // On indique la fiabilité de l'estimation : peu de données ou modèle peu prédictif = à prendre avec plus de recul
    const fiable = (feature.nbobs_com ?? 0) >= 30 && (feature.R2_adj ?? 0) >= 0.5;

    return {
      loyerM2: Math.round(loyerM2 * 100) / 100,
      loyerEstime,
      fiable
    };
  } catch (e) {
    console.error("Erreur API Carte des loyers :", e.message);
    return null;
  }
}
