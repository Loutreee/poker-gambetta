# Poker Gambetta

Application web pour gérer les comptes (ledger) d’une table de poker : classement des joueurs, soldes et historique. Déployable sur un VPS avec Docker.

## Stack

- **Frontend** : React 19, TypeScript, Vite, React Router, TanStack Query
- **Backend** : Node.js, Express, Prisma
- **Base de données** : PostgreSQL

## Développement local

### Prérequis

- Node.js 20+
- PostgreSQL (local ou Docker)

### 1. Base de données

Crée une base et note l’URL (ex. `postgresql://user:pass@localhost:5432/poker`).

Avec Docker :

```bash
docker run -d --name poker-db -e POSTGRES_USER=poker -e POSTGRES_PASSWORD=poker -e POSTGRES_DB=poker -p 5432:5432 postgres:16-alpine
```

### 2. Variables d’environnement (obligatoire avant les commandes backend)

**Crée le fichier `server/.env`** (Prisma et le seed en ont besoin) :

```bash
# Depuis la racine du projet
copy server\.env.example server\.env
```

Sous Linux/macOS : `cp server/.env.example server/.env`

Puis édite `server/.env` si besoin : par défaut l’URL pointe vers une base locale `poker` (user/mot de passe `poker`). Si tu as lancé le conteneur Docker ci‑dessus, garde ces valeurs.

### 3. Backend

Exécute chaque commande dans l’ordre (sous **Windows PowerShell**, ne pas utiliser `&&`, lancer les commandes une par une) :

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Le serveur tourne sur `http://localhost:3000`.

### 4. Frontend

Dans un autre terminal, à la racine du projet :

```bash
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173` et appelle l’API via le proxy Vite (`/api` → `localhost:3000`).

**Alternative (tout en un)** : à la racine du projet, `npm run dev:all` lance le backend et le frontend dans le même terminal.

### Comptes de démo (après seed)

- **Croupier** : Hugo / mot de passe `hugo`
- **Joueurs** : Thomas, Killian, Camille, Lou, Eliott, Marvin, Léane, Paul, Clementine — mot de passe = prénom en minuscules.

---

## Déploiement sur un VPS (Docker)

**Guide détaillé : [DEPLOY.md](./DEPLOY.md)** (connexion SSH, Docker, Nginx, HTTPS).

### Prérequis

- Docker et Docker Compose sur le VPS

### 1. Cloner le projet

```bash
git clone <url-du-repo> poker-gambetta
cd poker-gambetta
```

### 2. Variables d’environnement

Crée un fichier `.env` à la racine (à côté de `docker-compose.yml`) :

```env
JWT_SECRET=<génère-une-clé-secrète-longue-et-aléatoire>
CORS_ORIGIN=https://ton-domaine.com
```

Pour `CORS_ORIGIN`, mets l’URL publique de l’app (ex. `https://poker.example.com`). Si tu sers tout depuis le même domaine (app + API sur le même port), tu peux mettre la même URL.

### 3. Lancer avec Docker Compose

```bash
docker compose up -d --build
```

- L’app (front + API) est exposée sur le port **3000**.
- PostgreSQL tourne en interne (volume `postgres_data` pour la persistance).
- Au premier démarrage, les migrations Prisma et le seed sont exécutés automatiquement.

### 4. Accès

- En direct : `http://<IP-du-VPS>:3000`
- En production, place un reverse proxy (Nginx, Caddy, Traefik) devant le port 3000, avec HTTPS (Let’s Encrypt).

### Commandes utiles

```bash
# Voir les logs
docker compose logs -f app

# Arrêter
docker compose down

# Recréer les conteneurs après un git pull
docker compose up -d --build
```

---

## Structure du projet

```
poker-gambetta/
├── src/                 # Frontend React
│   ├── components/
│   ├── pages/
│   └── lib/
│       └── api.ts       # Client API
├── server/              # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts
│       ├── auth.ts      # JWT, middleware
│       └── routes/
├── scripts/
│   └── entrypoint.sh   # Migrations + seed au démarrage Docker
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Licence

Privé / usage personnel.
