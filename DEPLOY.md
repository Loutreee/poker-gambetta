# Déploiement Poker Gambetta sur un VPS

Guide pas à pas pour déployer l’app sur un VPS (Ubuntu/Debian) avec Docker, puis optionnellement Nginx + HTTPS.

---

## 1. Connexion au VPS

Depuis ton PC :

```bash
ssh ton_user@IP_DE_TON_VPS
```

Exemple : `ssh root@51.68.xxx.xxx` ou `ssh ubuntu@51.68.xxx.xxx`

---

## 2. Installer Docker et Docker Compose

Si ce n’est pas déjà fait :

```bash
# Mise à jour
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Docker Compose (plugin)
sudo apt install -y docker-compose-plugin
```

Déconnecte-toi puis reconnecte-toi pour que le groupe `docker` soit pris en compte, ou lance les commandes suivantes avec `sudo`.

Vérification :

```bash
docker --version
docker compose version
```

---

## 3. Récupérer le projet sur le VPS

### Option A : dépôt Git (recommandé)

```bash
cd ~
git clone https://github.com/TON_USER/poker-gambetta.git
cd poker-gambetta
```

Remplace par l’URL réelle de ton repo (GitHub, GitLab, etc.). Si le repo est privé, configure une clé SSH ou un token sur le VPS.

### Option B : copie avec SCP depuis ton PC

Sur ton **PC** (PowerShell) :

```powershell
scp -r C:\Users\OrdinateurKillian\Desktop\projet\poker-gambetta ton_user@IP_DU_VPS:~/poker-gambetta
```

Puis sur le VPS : `cd ~/poker-gambetta`.

---

## 4. Configurer les variables d’environnement

Sur le VPS, dans le dossier du projet :

```bash
cd ~/poker-gambetta   # ou le chemin où se trouve le projet

# Créer le fichier .env
nano .env
```

Contenu minimal (adapte l’URL si tu as un nom de domaine) :

```env
# Obligatoire : clé secrète pour les tokens de connexion (génère une valeur aléatoire)
JWT_SECRET=REMPLACE_PAR_UNE_LONGUE_CHAINE_ALEATOIRE

# URL à laquelle tu accèderas à l’app (pour les cookies CORS)
# Si tu accèdes via http://IP_DU_VPS:3000 → mets http://IP_DU_VPS:3000
# Si tu as un domaine avec HTTPS → mets https://ton-domaine.com
CORS_ORIGIN=http://IP_DE_TON_VPS:3000
```

Pour générer un `JWT_SECRET` fort :

```bash
openssl rand -base64 32
```

Colle le résultat dans `JWT_SECRET=...`, sauvegarde (`Ctrl+O`, Entrée) et quitte (`Ctrl+X`).

---

## 5. Lancer l’application

Toujours dans le dossier du projet :

```bash
docker compose up -d --build
```

- Premier lancement : le build peut prendre 2–5 minutes.
- L’app écoute sur le port **3000**.
- La base PostgreSQL est créée automatiquement (volume `postgres_data`).
- Les migrations et le seed (joueurs + bankrolls) sont exécutés au démarrage.

Vérifier que tout tourne :

```bash
docker compose ps
docker compose logs -f app
```

Tu peux arrêter les logs avec `Ctrl+C`.

Accès : ouvre **http://IP_DE_TON_VPS:3000** dans un navigateur. Connecte-toi avec un des comptes du seed (ex. Hugo / `hugo` pour le croupier).

---

## 6. (Optionnel) HTTPS avec un nom de domaine

Si tu as un **nom de domaine** qui pointe vers l’IP du VPS (ex. `poker.mondomaine.com`), tu peux mettre Nginx devant et activer HTTPS avec Let’s Encrypt.

### 6.1 Installer Nginx et Certbot

Sur le VPS :

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Configurer Nginx

Crée un fichier de config (remplace `poker.mondomaine.com` par ton domaine) :

```bash
sudo nano /etc/nginx/sites-available/poker-gambetta
```

Colle ce contenu (en remplaçant le domaine) :

```nginx
server {
    listen 80;
    server_name poker.mondomaine.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Active le site et recharge Nginx :

```bash
sudo ln -s /etc/nginx/sites-available/poker-gambetta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Obtenir le certificat SSL

```bash
sudo certbot --nginx -d poker.mondomaine.com
```

Réponds aux questions (email, acceptation des conditions). Certbot va modifier la config Nginx pour écouter en HTTPS.

### 6.4 Mettre à jour le .env de l’app

Dans `~/poker-gambetta/.env` :

```env
JWT_SECRET=ta_cle_generee_avant
CORS_ORIGIN=https://poker.mondomaine.com
```

Puis redémarre l’app :

```bash
cd ~/poker-gambetta
docker compose up -d
```

Tu peux maintenant utiliser **https://poker.mondomaine.com**.

---

## Commandes utiles

| Action | Commande |
|--------|----------|
| Voir les logs de l’app | `docker compose logs -f app` |
| Arrêter l’app | `docker compose down` |
| Redémarrer après un `git pull` | `docker compose up -d --build` |
| Rebuild complet (cache ignoré) | `docker compose build --no-cache && docker compose up -d` |

---

## Dépannage

- **Port 3000 déjà utilisé** : change dans `docker-compose.yml` par ex. `"8080:3000"` et accède via `http://IP:8080`.
- **Erreur de build** : vérifie que tout le projet est bien présent (notamment `server/`, `src/`, `Dockerfile`, `docker-compose.yml`).
- **502 Bad Gateway** avec Nginx : vérifie que les conteneurs tournent (`docker compose ps`) et que le proxy pointe bien vers `http://127.0.0.1:3000`.

Si tu me donnes ton OS VPS (Ubuntu/Debian), ton hébergeur et si tu as un domaine ou juste une IP, je peux adapter les commandes exactes pour toi.
