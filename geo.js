// Géographie : code INSEE, population et position des communes (geo.api.gouv.fr),
// et position approximative du quartier (géocodeur de la Géoplateforme IGN,
// qui remplace l'ancienne API Adresse api-adresse.data.gouv.fr depuis janvier 2026).
//
// Les annonces ne donnent presque jamais l'adresse exacte : la position enregistrée
// est donc celle du quartier quand il est connu et reconnu, sinon le centre de la commune.

const GEOCODEUR = "https://data.geopf.fr/geocodage/search";

export async function getCommuneInfo(ville, codePostal) {
  try {
    const params = new URLSearchParams({ fields: "code,nom,population,centre", limit: "1" });
    if (ville) params.set("nom", ville);
    if (codePostal) params.set("codePostal", codePostal);

    const response = await fetch(`https://geo.api.gouv.fr/communes?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const c = data[0];
    if (!c) return null;
    const coords = c.centre?.coordinates; // [longitude, latitude]
    return {
      code: c.code,
      nom: c.nom,
      population: c.population || 0,
      centre: coords ? { lat: coords[1], lon: coords[0] } : null
    };
  } catch (e) {
    console.error("Erreur geo.api.gouv.fr :", e.message);
    return null;
  }
}

/**
 * Conservé pour compatibilité : renvoie uniquement le code INSEE (utilisé par dvf.js, rent.js).
 */
export async function getCodeInsee(ville, codePostal) {
  const info = await getCommuneInfo(ville, codePostal);
  return info?.code || null;
}

/**
 * Position approximative d'un bien : { lat, lon, precision: "quartier" | "commune" } ou null.
 * @param {object} listing - doit contenir ville (et idéalement code_postal, quartier)
 * @param {object} [commune] - résultat de getCommuneInfo s'il est déjà connu (évite un appel)
 */
export async function geocodeListing(listing, commune) {
  const info = commune || await getCommuneInfo(listing.ville, listing.code_postal);
  if (!info) return null;

  if (listing.quartier) {
    try {
      const params = new URLSearchParams({ q: `${listing.quartier} ${info.nom}`, citycode: info.code, limit: "1" });
      const response = await fetch(`${GEOCODEUR}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const f = data.features?.[0];
        if (f && (f.properties?.score ?? 0) >= 0.45 && f.geometry?.coordinates) {
          return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], precision: "quartier" };
        }
      }
    } catch (e) {
      console.error("Erreur géocodage quartier :", e.message);
    }
  }

  return info.centre ? { ...info.centre, precision: "commune" } : null;
}
