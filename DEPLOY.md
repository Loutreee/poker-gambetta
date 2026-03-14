# Mise en production — Poker Gambetta & Betting Gambetta

Ce document décrit ce qu’il faut mettre en place pour déployer ce monorepo en production. Il est destiné à l’équipe (ou au LLM) qui gère le déploiement.

## Résumé du projet

- **Deux applications web** qui partagent le **même backend** (Express + Prisma + PostgreSQL) et la **même base utilisateurs** :
  - **Poker Gambetta** : classement, sessions, ledger, bankroll, badges.
  - **Betting Gambetta** : paris sur les matchs CS ArcMonkey, règlement manuel ou automatique (API Faceit).
- En production avec Docker, **chaque app est un conteneur distinct** : chaque conteneur embarque son front (Poker ou Betting) + une instance du même backend. Une **seule base PostgreSQL** est utilisée par les deux.

## Stack Docker

- **docker-compose.yml** définit 3 services :
  - **db** : PostgreSQL 16 (port 5432)
  - **poker-app** : front Poker + backend (port 3000 en interne, exposé sur le port hôte configuré, ex. 3000)
  - **betting-app** : front Betting + backend (port 3000 en interne, exposé sur le port hôte, ex. 3001)

Au démarrage de chaque app (poker-app et betting-app), l’**entrypoint** exécute :
1. `npx prisma migrate deploy` (migrations DB)
2. `node server/dist/seed.js` (seed ignoré si déjà fait)
3. Démarrage du serveur Node qui sert le front en statique et l’API sous `/api`.

## Ce qu’il faut mettre en place

### 1. Fichier `.env` à la racine du projet

Créer un `.env` à côté de `docker-compose.yml` (voir `.env.docker.example` pour un modèle) avec au minimum :

```env
# Obligatoire
JWT_SECRET=<une-vraie-secret-long-et-aleatoire>
CORS_ORIGIN=https://ton-domaine-poker.com,https://ton-domaine-betting.com

# URLs des apps (pour les liens croisés Poker ↔ Betting) — utilisées au BUILD
VITE_BETTING_APP_URL=https://ton-domaine-betting.com
VITE_POKER_APP_URL=https://ton-domaine-poker.com

# Optionnel : règlement auto des paris depuis Faceit
FACEIT_API_KEY=<cle-api-faceit>

# Optionnel : avatars / pseudos Steam des joueurs ArcMonkey
STEAM_API_KEY=<cle-api-steam>
```

- **JWT_SECRET** : secret partagé pour les cookies de session ; doit être le même pour les deux apps (même backend logique).
- **CORS_ORIGIN** : origines autorisées (URLs finales des deux fronts), séparées par des virgules, sans espace superflu.
- **VITE_BETTING_APP_URL** / **VITE_POKER_APP_URL** : injectées **au build** des images Docker (lien « Match programmé » sur Poker, onglet « Poker » sur Betting). Si omises, les builds utilisent des fallbacks localhost (à éviter en prod).
- **FACEIT_API_KEY** : nécessaire uniquement si tu veux le règlement automatique des paris depuis Faceit (optionnel).
- **STEAM_API_KEY** : optionnel, pour les avatars Steam sur la page Betting.

### 2. Base de données

- Le service **db** utilise par défaut : `POSTGRES_USER=poker`, `POSTGRES_PASSWORD=poker`, `POSTGRES_DB=poker`.
- Les apps utilisent `DATABASE_URL=postgresql://poker:poker@db:5432/poker` (déjà défini dans `docker-compose.yml`).
- Si tu utilises une base gérée (ex. Postgres hébergé), remplace `DATABASE_URL` dans les blocs `environment` de `poker-app` et `betting-app` par l’URL réelle (et retire ou adapte le service `db` si tu n’en as pas besoin).

### 3. Build et lancement

```bash
docker compose up -d --build
```

- **Premier déploiement** : les migrations s’exécutent au démarrage des conteneurs (entrypoint). Le seed peut être exécuté une fois (il est idempotent).
- Pour que les liens inter-apps soient corrects en prod, **VITE_BETTING_APP_URL** et **VITE_POKER_APP_URL** doivent être définis dans le `.env` **avant** le `docker compose build` (ou `--build`), car ce sont des variables de **build**.

### 4. Reverse proxy (Nginx / Caddy / Traefik)

En production, on expose en général les deux apps derrière un reverse proxy :

- Une **entrée** (ex. `https://poker.example.com`) → proxy vers `poker-app:3000`.
- Une **autre entrée** (ex. `https://betting.example.com`) → proxy vers `betting-app:3000` (mappé en interne sur le port du conteneur).

**CORS_ORIGIN** doit contenir exactement les URLs utilisées par le navigateur (ex. `https://poker.example.com,https://betting.example.com`).

Exemple Nginx (à adapter) :

```nginx
# Poker
server {
  server_name poker.example.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

# Betting
server {
  server_name betting.example.com;
  location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

(En Docker Swarm/Kubernetes, tu pointes vers les services correspondants au lieu de `localhost`.)

### 5. Volumes

- **postgres_data** : données PostgreSQL (si tu utilises le service `db`).
- **uploads_data** : fichiers uploadés (avatars) partagés entre les deux apps ; à monter de la même façon sur les deux conteneurs si tu veux un stockage commun.

### 6. Comptes et rôles

- Après le seed : un compte **Killian** a les droits admin sur **Betting** (création de matchs, équipe ArcMonkey, règlement des paris). Les autres comptes sont définis dans le seed (voir `server`).
- Les **badges** (dont le badge spécial « Euuh mec ? » pour avoir gagné un pari sur la défaite d’ArcMonkey) sont calculés côté backend à partir des données (sessions, paris, etc.) ; rien de plus à configurer.

## Résumé des variables d’environnement

| Variable | Où | Obligatoire | Description |
|----------|-----|-------------|-------------|
| `JWT_SECRET` | runtime (compose) | Oui | Secret JWT des cookies de session. |
| `CORS_ORIGIN` | runtime (compose) | Oui | Origines autorisées (URLs des deux fronts), séparées par des virgules. |
| `VITE_BETTING_APP_URL` | build (compose build args) | Recommandé en prod | URL du site Betting (pour le front Poker). |
| `VITE_POKER_APP_URL` | build (compose build args) | Recommandé en prod | URL du site Poker (pour le front Betting). |
| `DATABASE_URL` | runtime (compose) | Oui (ou via db) | URL PostgreSQL. Déjà définie pour le cas « db » dans le compose. |
| `FACEIT_API_KEY` | runtime (compose) | Non | Règlement automatique des paris depuis Faceit. |
| `STEAM_API_KEY` | runtime (compose) | Non | Avatars / pseudos Steam (Betting). |

## Test de déploiement Docker

Pour vérifier que le build et le démarrage du stack fonctionnent (sans reverse proxy) :

```bash
npm run test:docker
```

Ce script (voir `scripts/docker-deploy-test.cjs`) :
1. Lance `docker compose build --no-cache`
2. Démarre le stack (`docker compose up -d`)
3. Attend que les fronts répondent sur les ports 3000 (Poker) et 3001 (Betting)
4. Vérifie les endpoints `/` et `/api/auth/me`
5. Arrête le stack (`docker compose down`)

**Prérequis** : Docker et Docker Compose installés ; les ports 3000, 3001 et 5432 doivent être libres. Aucun `.env` n’est requis (le script utilise des variables de test).

## Vérification rapide

- Poker : ouvrir l’URL du front Poker → classement, login, sessions.
- Betting : ouvrir l’URL du front Betting → accueil, « Prochain match », paris, admin (avec le compte Killian).
- Les deux doivent utiliser la même base (mêmes utilisateurs) et les liens « Poker » / « Match programmé » doivent pointer vers les bonnes URLs si `VITE_*` ont été définis au build.
