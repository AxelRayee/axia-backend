// Ce petit module convertit une ville en "code INSEE" (l'identifiant officiel unique
// d'une commune française). C'est utilisé à la fois par dvf.js (prix de vente) et
// rent.js (estimation de loyer), d'où sa mise en commun ici.

/**
 * Convertit un couple ville/code postal en code INSEE
 */
export async function getCodeInsee(ville, codePostal) {
  try {
    const params = new URLSearchParams({ fields: "code", limit: "1" });
    if (ville) params.set("nom", ville);
    if (codePostal) params.set("codePostal", codePostal);

    const url = `https://geo.api.gouv.fr/communes?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data[0]?.code || null;
  } catch (e) {
    console.error("Erreur geo.api.gouv.fr :", e.message);
    return null;
  }
}
