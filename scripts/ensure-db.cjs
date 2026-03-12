#!/usr/bin/env node
/**
 * Démarre le conteneur Postgres (docker compose up -d db) et attend
 * que le port 5432 soit joignable. À lancer avant dev:all si la DB
 * n'est pas déjà démarrée.
 */

const { spawn, spawnSync } = require("child_process");
const net = require("net");
const path = require("path");
const fs = require("fs");

const REPO_ROOT = path.join(__dirname, "..");
const PORT = 5432;
const TIMEOUT_MS = 60000;
const RETRY_MS = 2000;

function runDockerComposeUp() {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["compose", "up", "-d", "db"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose up -d db a échoué (code ${code}).\n${stderr}`));
    });
    proc.on("error", (err) => reject(err));
  });
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(2000);
    socket.on("connect", () => onDone(true));
    socket.on("timeout", () => onDone(false));
    socket.on("error", () => onDone(false));
    socket.connect(port, host);
  });
}

function waitForPort(host, port, timeoutMs, retryMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = async () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout: le port ${port} n'est pas joignable après ${timeoutMs / 1000}s. Vérifiez que Docker tourne et que le service db a démarré.`));
        return;
      }
      if (await isPortOpen(host, port)) {
        resolve();
        return;
      }
      setTimeout(tryConnect, retryMs);
    };
    tryConnect();
  });
}

async function main() {
  const composePath = path.join(REPO_ROOT, "docker-compose.yml");
  if (!fs.existsSync(composePath)) {
    console.error("scripts/ensure-db.cjs: docker-compose.yml introuvable à la racine du projet.");
    process.exit(1);
  }

  console.log("Vérification de la base de données Postgres...");
  if (await isPortOpen("127.0.0.1", PORT)) {
    console.log("Postgres est déjà joignable sur le port 5432.");
    const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: path.join(REPO_ROOT, "server"),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(r.status !== 0 ? 1 : 0);
    return;
  }

  console.log("Démarrage du conteneur Postgres (docker compose up -d db)...");
  try {
    await runDockerComposeUp();
  } catch (e) {
    console.error(e.message || e);
    console.error("\nAssurez-vous que Docker Desktop est lancé, puis réessayez.");
    process.exit(1);
  }

  console.log("En attente que Postgres accepte les connexions...");
  try {
    await waitForPort("127.0.0.1", PORT, TIMEOUT_MS, RETRY_MS);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  console.log("Postgres est prêt. Application des migrations Prisma...");
  const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.join(REPO_ROOT, "server"),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error("Échec des migrations Prisma.");
    process.exit(1);
  }
  console.log("Migrations appliquées.");
  process.exit(0);
}

main();
