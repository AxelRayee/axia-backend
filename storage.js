// Ce module gère la sauvegarde de vos analyses dans une vraie base de données
// en ligne (MongoDB Atlas, offre gratuite), plutôt que dans un simple fichier.
// Avantage : vos données survivent peu importe où le serveur tourne (votre PC ou Render),
// et ne dépendent plus du disque "temporaire" d'un hébergeur gratuit.

import { MongoClient } from "mongodb";

let client;
let dbInstance;

/**
 * Se connecte à la base de données (une seule fois, puis réutilise la connexion).
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI n'est pas défini. Vérifiez votre fichier .env (ou les variables d'environnement sur Render)."
    );
  }

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  dbInstance = client.db("axia"); // nom de la base de données
  return dbInstance;
}

/**
 * Retire le champ technique "_id" ajouté automatiquement par MongoDB,
 * pour que le reste du code (et le site) continue de fonctionner comme avant.
 */
function clean(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

/**
 * Lit toutes les analyses sauvegardées, les plus récentes en premier.
 */
export async function readListings() {
  const db = await getDb();
  const docs = await db.collection("listings").find({}).sort({ savedAt: -1 }).toArray();
  return docs.map(clean);
}

/**
 * Ajoute une nouvelle analyse.
 */
export async function addListing(entry) {
  const db = await getDb();
  const entryWithId = {
    id: Date.now().toString(),
    savedAt: new Date().toISOString(),
    ...entry
  };
  await db.collection("listings").insertOne(entryWithId);
  return clean(entryWithId);
}

/**
 * Met à jour une analyse existante (par exemple après correction manuelle du loyer).
 */
export async function updateListing(id, changes) {
  const db = await getDb();
  await db.collection("listings").updateOne({ id }, { $set: changes });
  const updated = await db.collection("listings").findOne({ id });
  return clean(updated);
}

/**
 * Supprime une analyse par son identifiant, et renvoie la liste mise à jour.
 */
export async function deleteListing(id) {
  const db = await getDb();
  await db.collection("listings").deleteOne({ id });
  return readListings();
}

/**
 * Lit le "profil fiscal" global (tranche d'imposition, hypothèses d'amortissement).
 * Un seul document, réutilisé sur toutes les analyses.
 */
export async function readProfilFiscal() {
  const db = await getDb();
  const doc = await db.collection("settings").findOne({ _key: "profil_fiscal" });
  if (!doc) {
    return { tmi: 30, partTerrainPct: 15, dureeAmortImmeubleAns: 25, dureeAmortTravauxAns: 10 };
  }
  const { _id, _key, ...rest } = doc;
  return rest;
}

export async function saveProfilFiscal(data) {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { _key: "profil_fiscal" },
    { $set: { _key: "profil_fiscal", ...data } },
    { upsert: true }
  );
  return readProfilFiscal();
}
