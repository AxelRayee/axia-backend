// Convertit une ville en code INSEE (identifiant officiel de commune), et récupère
// sa population (utilisée pour estimer grossièrement la taxe foncière par taille de ville).

export async function getCommuneInfo(ville, codePostal) {
  try {
    const params = new URLSearchParams({ fields: "code,nom,population", limit: "1" });
    if (ville) params.set("nom", ville);
    if (codePostal) params.set("codePostal", codePostal);

    const url = `https://geo.api.gouv.fr/communes?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data[0]) return null;
    return { code: data[0].code, nom: data[0].nom, population: data[0].population || 0 };
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
