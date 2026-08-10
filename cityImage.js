// Ce module récupère une photo représentative d'une ville via Wikipedia,
// utilisée comme image de secours quand on ne trouve pas de photo dans l'annonce
// elle-même (cas d'un texte collé, ou d'un site qui ne fournit pas d'image de prévisualisation).
//
// Wikipedia est gratuit, sans clé API, et couvre à peu près toutes les communes françaises.

/**
 * Cherche une image représentative d'une ville sur Wikipedia (langue française)
 * @param {string} ville
 * @returns {string|null} - l'URL de l'image, ou null si rien trouvé
 */
export async function getCityImage(ville) {
  if (!ville) return null;

  try {
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ville)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "AxIA/1.0 (usage personnel)" }
    });
    if (!response.ok) return null;

    const data = await response.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch (e) {
    console.error("Erreur récupération image ville (Wikipedia) :", e.message);
    return null;
  }
}
