import { promises as fs } from "fs";
import path from "path";

// Le fichier où toutes vos analyses seront sauvegardées, sur votre ordinateur
const DATA_FILE = path.join(process.cwd(), "data.json");

/**
 * Lit toutes les analyses sauvegardées. Si le fichier n'existe pas encore
 * (première utilisation), renvoie une liste vide plutôt qu'une erreur.
 */
export async function readListings() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") {
      // Le fichier n'existe pas encore : c'est la toute première analyse, rien d'anormal
      return [];
    }
    throw e;
  }
}

/**
 * Ajoute une nouvelle analyse en haut de la liste, puis sauvegarde tout sur le disque.
 */
export async function addListing(entry) {
  const listings = await readListings();
  const entryWithId = {
    id: Date.now().toString(), // identifiant unique basé sur l'heure d'ajout
    savedAt: new Date().toISOString(),
    ...entry
  };
  listings.unshift(entryWithId);
  await fs.writeFile(DATA_FILE, JSON.stringify(listings, null, 2), "utf-8");
  return entryWithId;
}

/**
 * Met à jour une analyse existante (par exemple après correction manuelle du loyer)
 * et renvoie l'entrée mise à jour.
 */
export async function updateListing(id, changes) {
  const listings = await readListings();
  const index = listings.findIndex((l) => l.id === id);
  if (index === -1) return null;

  listings[index] = { ...listings[index], ...changes };
  await fs.writeFile(DATA_FILE, JSON.stringify(listings, null, 2), "utf-8");
  return listings[index];
}

/**
 * Supprime une analyse par son identifiant.
 */
export async function deleteListing(id) {
  const listings = await readListings();
  const filtered = listings.filter((l) => l.id !== id);
  await fs.writeFile(DATA_FILE, JSON.stringify(filtered, null, 2), "utf-8");
  return filtered;
}
