# AxIA — Backend

Ce dossier contient le "backend" d'AxIA : le programme invisible qui va chercher les informations d'une annonce, les fait analyser par l'IA, puis les compare au marché réel (DVF).

Ce guide part du principe que vous ne connaissez pas le code — chaque étape est expliquée.

## Ce que fait ce backend, en résumé

1. Vous lui envoyez le lien d'une annonce (depuis le site AxIA).
2. Il télécharge le contenu de la page.
3. Il demande à l'IA (Claude) d'en extraire les informations utiles : prix, surface, ville, DPE...
4. Il interroge une base de données publique et gratuite (DVF) pour connaître les prix réels de vente dans le même secteur.
5. Il calcule le rendement, l'écart au marché, et un score global.
6. Il renvoie tout ça au site, qui l'affiche.

## Étape 1 — Installer Node.js

Node.js est le programme qui permet à votre ordinateur d'exécuter du code JavaScript en dehors d'un navigateur — c'est ce qui va faire tourner ce backend.

1. Allez sur https://nodejs.org
2. Téléchargez la version "LTS" (recommandée, la plus stable)
3. Installez-la comme n'importe quel logiciel

Pour vérifier que ça a fonctionné, ouvrez votre **Terminal** (Mac : application "Terminal" ; Windows : "Invite de commandes" ou "PowerShell") et tapez :

```
node -v
```

Si un numéro de version s'affiche (ex: v20.11.0), c'est bon.

## Étape 2 — Récupérer une clé API Anthropic

C'est le "mot de passe" qui permet à votre backend d'utiliser l'IA Claude.

1. Allez sur https://console.anthropic.com
2. Créez un compte si vous n'en avez pas
3. Allez dans "Settings" → "API Keys"
4. Créez une nouvelle clé et copiez-la (elle ne s'affichera qu'une seule fois, gardez-la de côté)

Notez qu'utiliser l'API a un coût (facturé à l'usage, généralement quelques centimes par annonce analysée) — ce n'est pas la même chose que votre abonnement Claude.ai personnel.

## Étape 3 — Configurer le projet

1. Placez tous les fichiers de ce dossier (server.js, package.json, etc.) dans un dossier sur votre ordinateur, par exemple `axia-backend`
2. Dans ce dossier, dupliquez le fichier `.env.example` et renommez la copie en `.env`
3. Ouvrez `.env` et remplacez `votre_cle_ici` par votre vraie clé API Anthropic

## Étape 4 — Installer les dépendances

Une "dépendance", c'est un petit programme écrit par quelqu'un d'autre qu'on réutilise plutôt que de tout recoder soi-même (ici : le serveur web, la connexion à l'IA, etc.).

Dans le Terminal, déplacez-vous dans le dossier du projet puis lancez l'installation :

```
cd chemin/vers/axia-backend
npm install
```

Cela va télécharger tout ce qu'il faut (ça peut prendre une minute).

## Étape 5 — Démarrer le backend en local

```
npm start
```

Si tout va bien, vous verrez s'afficher :
```
AxIA backend démarré sur http://localhost:3001
```

Ça veut dire que votre backend tourne, mais uniquement sur votre ordinateur pour l'instant (personne d'autre ne peut y accéder).

## Étape 6 — Tester que ça fonctionne

Laissez le Terminal ouvert et lancez cette commande dans un **second** Terminal :

```
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.exemple-annonce.fr/bien-123", "monthlyRent": 850}'
```

Remplacez l'URL par un vrai lien d'annonce. Vous devriez recevoir une réponse au format JSON avec les informations extraites, la comparaison marché, et le score.

## Étape 7 — Mettre le backend en ligne (pour qu'il soit accessible depuis internet, pas juste votre ordinateur)

Pour l'instant le backend tourne uniquement "en local" (sur votre machine). Pour que le site AxIA puisse l'utiliser depuis n'importe où, il faut l'héberger sur un serveur en ligne.

Je recommande **Render** (render.com) pour démarrer : simple, gratuit pour un usage léger, pas de carte bancaire requise pour l'offre gratuite.

1. Créez un compte sur https://render.com
2. Mettez votre projet sur GitHub (on peut voir ça ensemble si besoin)
3. Sur Render : "New" → "Web Service" → connectez votre dépôt GitHub
4. Dans les paramètres, ajoutez votre variable d'environnement `ANTHROPIC_API_KEY` (dans la section "Environment")
5. Render vous donnera une adresse du type `https://axia-backend.onrender.com` — c'est celle que le site utilisera pour parler au backend

## Points d'attention

- **La clé API ne doit jamais apparaître dans le code envoyé sur GitHub si le dépôt est public.** Le fichier `.env` est fait pour ça : il reste sur votre machine (ou dans les réglages sécurisés de Render), jamais dans le code partagé.
- **L'API DVF utilisée (Cerema) est encore en version bêta** ("preprod" dans son adresse) : son fonctionnement peut évoluer. Si la comparaison marché cesse de fonctionner un jour, c'est le premier endroit à vérifier (fichier `dvf.js`).
- **Chaque annonce analysée a un coût réel** (appel à l'IA + hébergement). Rien d'énorme pour un usage personnel, mais bon à savoir.

## Prochaine étape

Une fois ce backend en ligne, il restera à connecter le site AxIA (la partie visuelle qu'on a construite avant) à cette adresse, pour que le bouton "Analyser" fonctionne pour de vrai.
