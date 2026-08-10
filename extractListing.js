import Anthropic from "@anthropic-ai/sdk";

/**
 * Cherche l'image de prévisualisation d'une page web (balise "og:image"),
 * utilisée par la plupart des sites pour l'aperçu quand on partage un lien.
 */
function findPreviewImage(html) {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match ? match[1] : null;
}

/**
 * Prépare le texte à analyser : si c'est une URL, on télécharge la page.
 * Si c'est déjà du texte (l'utilisateur a copié-collé l'annonce), on l'utilise tel quel.
 * @param {string} input - soit une URL, soit le texte brut d'une annonce
 */
async function getRawText(input) {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  if (!isUrl) {
    // L'utilisateur a collé directement le texte de l'annonce : pas d'image disponible ici
    return { text: trimmed, sourceUrl: null, imageUrl: null };
  }

  const response = await fetch(trimmed, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AxIA/1.0)" }
  });
  if (!response.ok) {
    throw new Error(
      `Impossible de récupérer la page (statut ${response.status}). ` +
      `Certains sites (LeBonCoin, SeLoger...) bloquent les accès automatisés : ` +
      `essayez de copier-coller directement le texte de l'annonce à la place du lien.`
    );
  }
  const html = await response.text();
  const imageUrl = findPreviewImage(html);
  return { text: html, sourceUrl: trimmed, imageUrl };
}

/**
 * Extrait les informations clés d'une annonce, que ce soit à partir d'une URL ou d'un texte collé.
 * @param {string} input - URL de l'annonce OU texte brut copié-collé par l'utilisateur
 */
export async function extractListingFromUrl(input) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const { text: rawText, sourceUrl, imageUrl } = await getRawText(input);

  const text = rawText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);

  if (text.length < 20) {
    throw new Error("Le texte fourni est trop court pour être analysé. Vérifiez le lien ou collez le texte complet de l'annonce.");
  }

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Voici le texte brut d'une annonce immobilière (venant soit d'une page web, soit collé directement par l'utilisateur). Extrait uniquement les informations suivantes et réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown :

{
  "prix": nombre (en euros, sans espace ni symbole),
  "surface": nombre (en m²),
  "ville": chaîne de caractères,
  "quartier": chaîne de caractères ou null (quartier ou secteur précis si mentionné),
  "code_postal": chaîne de caractères ou null,
  "type_bien": "Appartement" ou "Maison",
  "pieces": nombre ou null,
  "dpe": lettre A à G ou null,
  "contact": chaîne de caractères ou null (nom de l'agence, du contact, ou numéro de téléphone si mentionné),
  "resume": courte phrase résumant le bien
}

Si une information est introuvable, mets sa valeur à null. N'invente jamais de chiffre.

Texte de l'annonce :
"""${text}"""`
      }
    ]
  });

  const raw = message.content.find((b) => b.type === "text")?.text || "{}";
  // On extrait uniquement le bloc JSON (entre la première { et la dernière }),
  // au cas où l'IA aurait ajouté du texte avant/après malgré la consigne.
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const cleaned = jsonStart !== -1 && jsonEnd !== -1
    ? raw.slice(jsonStart, jsonEnd + 1)
    : raw.replace(/```json|```/g, "").trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("L'IA n'a pas réussi à extraire des données exploitables de ce texte.");
  }

  return {
    ...data,
    url: sourceUrl,
    imageUrl: imageUrl || null, // image de l'annonce si trouvée, sinon complétée plus tard par une image de ville
    prixM2: data.prix && data.surface ? Math.round(data.prix / data.surface) : null
  };
}
