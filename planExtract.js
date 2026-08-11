// Lit un plan (image ou PDF) fourni par l'utilisateur, et en extrait la liste des pièces
// avec leurs mesures — À CONDITION que ces mesures soient déjà écrites sur le plan
// (longueur, surface, hauteur sous plafond). Ce module ne "mesure" jamais lui-même
// une distance sur l'image : il LIT des chiffres déjà présents, ce qui est fiable.
// Si le plan ne contient pas ces annotations, l'utilisateur doit saisir les pièces à la main.

import Anthropic from "@anthropic-ai/sdk";

export async function extractPlanRooms(imageBase64, mimeType) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isPdf = mimeType === "application/pdf";
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } };

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text: `Voici un plan de logement. Certains plans indiquent déjà, pour chaque pièce, sa surface au sol (m²), la longueur totale de ses murs (périmètre, en mètres), et parfois la hauteur sous plafond.

Lis UNIQUEMENT les chiffres déjà écrits sur ce plan — ne mesure jamais toi-même une distance sur l'image, n'invente aucun chiffre. Si une information n'est pas écrite sur le plan, mets sa valeur à null.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown :

{
  "hauteurGenerale": nombre en mètres ou null (hauteur sous plafond si indiquée une seule fois pour tout le logement),
  "pieces": [
    {
      "nom": chaîne de caractères (ex: "Séjour", "Chambre 1"),
      "surfaceSol": nombre en m² ou null,
      "longueurMurs": nombre en mètres ou null (périmètre de la pièce, si indiqué),
      "hauteur": nombre en mètres ou null (si différente de la hauteur générale)
    }
  ]
}

Si aucune pièce n'a de mesure exploitable, réponds avec "pieces": [].`
          }
        ]
      }
    ]
  });

  const raw = message.content.find((b) => b.type === "text")?.text || "{}";
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const cleaned = jsonStart !== -1 && jsonEnd !== -1 ? raw.slice(jsonStart, jsonEnd + 1) : "{}";

  try {
    const data = JSON.parse(cleaned);
    const hauteurDefaut = data.hauteurGenerale || 2.5; // hauteur standard française si rien n'est indiqué
    const pieces = (data.pieces || []).map((p) => {
      const hauteur = p.hauteur || hauteurDefaut;
      const surfaceMurs = p.longueurMurs ? Math.round(p.longueurMurs * hauteur * 10) / 10 : null;
      return {
        nom: p.nom || "Pièce",
        surfaceSol: p.surfaceSol || null,
        longueurMurs: p.longueurMurs || null,
        hauteur,
        surfaceMurs,
        postes: {}
      };
    });
    return pieces;
  } catch (e) {
    console.error("Impossible d'analyser la réponse de lecture du plan :", e.message);
    return [];
  }
}
