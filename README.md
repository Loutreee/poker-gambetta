# Poker Gambetta & Betting Gambetta

Monorepo contenant :

- **Poker Gambetta** : gestion des comptes (ledger) d’une table de poker — classement, soldes, sessions, historique.
- **Betting Gambetta** : paris amicaux sur les matchs CS de l’équipe ArcMonkey — mise, règlement manuel ou automatique (API Faceit), historique des paris.

Les deux apps partagent le **même backend** (Express, Prisma, PostgreSQL) et le **même compte utilisateur** (auth, bankroll).

## Stack

- **Frontends** : React 19, TypeScript, Vite, React Router, TanStack Query (Poker : port 5173, Betting : port 5174 en dev).
- **Backend** : Node.js, Express, Prisma.
- **Base de données** : PostgreSQL.

## Développement local

### Prérequis

- Node.js 20+
- PostgreSQL (local ou Docker)

### 1. Base de données

Crée une base et note l’URL (ex. `postgresql://poker:poker@localhost:5432/poker`).

Avec Docker :

```bash
docker run -d --name poker-db -e POSTGRES_USER=poker -e POSTGRES_PASSWORD=poker -e POSTGRES_DB=poker -p 5432:5432 postgres:16-alpine
```

### 2. Variables d’environnement

**Backend** — crée `server/.env` à partir de `server/.env.example` :

```bash
copy server\.env.example server\.env
```

Édite au besoin : `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (en dev : `http://localhost:5173,http://localhost:5174`).  
Pour le règlement automatique des paris depuis Faceit, renseigne `FACEIT_API_KEY` (voir [developers.faceit.com](https://developers.faceit.com/)).

**Frontends (optionnel en dev)**  
- `apps/poker-gambetta/.env` : `VITE_BETTING_APP_URL=http://localhost:5174` pour le lien vers Betting depuis la carte « Match programmé ».  
- `apps/betting-gambetta/.env` : `VITE_POKER_APP_URL=http://localhost:5173` pour l’onglet « Poker » dans la nav.

### 3. Installation et migrations

À la racine (PowerShell, commandes une par une si besoin) :

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
cd ..
npm install
```

### 4. Lancer tout (backend + Poker + Betting)

À la racine :

```bash
npm run dev:all
```

- **API** : http://localhost:3001  
- **Poker** : http://localhost:5173 (proxy `/api` → 3001)  
- **Betting** : http://localhost:5174 (proxy `/api` → 3001)

Pour lancer uniquement le backend : `npm run dev:server` (depuis `server/`).  
Pour un seul front : `npm run dev:poker` ou `npm run dev:betting`.

### Comptes (après seed)

- **Croupier** : Hugo / `hugo`  
- **Joueurs** : Thomas, Killian, Camille, Lou, Eliott, Marvin, Léane, Paul, Clementine — mot de passe = prénom en minuscules.

Sur **Betting**, le compte **Killian** a les droits admin (matchs, équipe ArcMonkey, règlement des paris).

---

## Déploiement (Docker)

Chaque app (Poker ou Betting) est déployée avec **son propre backend** (une instance Express par front).

1. À la racine : crée un `.env` avec `JWT_SECRET`, `CORS_ORIGIN`, `DATABASE_URL`, etc.
2. `docker compose up -d --build`
3. **poker-app** : port 3000 ; **betting-app** : port 3001.  
En prod, configure un reverse proxy (Nginx, Caddy) et les variables `VITE_*` au build si besoin.

---

## Structure

```
poker-gambetta/
├── apps/
│   ├── poker-gambetta/     # Front Poker (classement, sessions, ledger)
│   └── betting-gambetta/  # Front Betting (matchs, paris, règlement)
├── server/                 # Backend commun
│   ├── prisma/
│   └── src/
│       ├── index.ts
│       ├── auth.ts
│       ├── faceit.ts      # API Faceit (règlement auto)
│       ├── bettingConstants.ts
│       └── routes/
│           ├── auth.ts
│           ├── betting.ts
│           └── ...
├── scripts/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Variables d’environnement (résumé)

| Variable | Où | Description |
|----------|-----|-------------|
| `DATABASE_URL` | server | URL PostgreSQL |
| `JWT_SECRET` | server | Secret des cookies de session |
| `CORS_ORIGIN` | server | Origines autorisées (ex. `http://localhost:5173,http://localhost:5174`) |
| `FACEIT_API_KEY` | server | Clé API Faceit (règlement auto des paris) |
| `STEAM_API_KEY` | server | Clé API Steam (avatars/pseudos ArcMonkey) |
| `VITE_BETTING_APP_URL` | poker-gambetta | URL du site Betting (carte « Match programmé ») |
| `VITE_POKER_APP_URL` | betting-gambetta | URL du site Poker (onglet « Poker ») |

---

Licence : privé / usage personnel.
