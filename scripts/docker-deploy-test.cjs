/**
 * Test de déploiement Docker : build des images, démarrage du stack, vérification des endpoints, arrêt.
 * Usage : node scripts/docker-deploy-test.cjs
 * Prérequis : Docker et Docker Compose installés, pas de services déjà en écoute sur 3000, 3001, 5432.
 */

const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const REPO_ROOT = path.resolve(__dirname, "..");
const COMPOSE_FILE = path.join(REPO_ROOT, "docker-compose.yml");
const TEST_ENV = {
  ...process.env,
  JWT_SECRET: "test-secret-for-docker-deploy-test",
  CORS_ORIGIN: "http://localhost:3000,http://localhost:3001",
  VITE_BETTING_APP_URL: "http://localhost:3001",
  VITE_POKER_APP_URL: "http://localhost:3000",
};

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: REPO_ROOT,
      stdio: opts.silent ? "pipe" : "inherit",
      env: opts.env ?? process.env,
      shell: opts.shell ?? false,
    });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exit ${code}`))));
  });
}

function waitFor(url, maxAttempts = 30, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryFetch() {
      attempts++;
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === "https:" ? 443 : 80),
          path: u.pathname || "/",
          method: "GET",
          timeout: 5000,
        },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) return resolve();
          if (attempts >= maxAttempts) return reject(new Error(`${url} returned ${res.statusCode}`));
          setTimeout(tryFetch, intervalMs);
        }
      );
      req.on("error", () => {
        if (attempts >= maxAttempts) return reject(new Error(`${url} connection failed after ${maxAttempts} attempts`));
        setTimeout(tryFetch, intervalMs);
      });
      req.end();
    }
    tryFetch();
  });
}

async function main() {
  console.log("=== Test déploiement Docker ===\n");

  // 1. Build
  console.log("1. Build des images Docker...");
  await run("docker", ["compose", "-f", COMPOSE_FILE, "build", "--no-cache"], { env: TEST_ENV }).catch((e) => {
    console.error("Build échoué:", e.message);
    process.exit(1);
  });

  // 2. Démarrage
  console.log("\n2. Démarrage du stack (db + poker-app + betting-app)...");
  await run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { env: TEST_ENV }).catch((e) => {
    console.error("docker compose up échoué:", e.message);
    process.exit(1);
  });

  // 3. Attente que les services répondent
  console.log("\n3. Attente des services (max 60s)...");
  try {
    await Promise.all([
      waitFor("http://localhost:3000/"),
      waitFor("http://localhost:3001/"),
    ]);
  } catch (e) {
    console.error("Les services n'ont pas répondu:", e.message);
    await run("docker", ["compose", "-f", COMPOSE_FILE, "logs", "--tail", "50"], { env: TEST_ENV });
    await run("docker", ["compose", "-f", COMPOSE_FILE, "down"], { env: TEST_ENV });
    process.exit(1);
  }

  // 4. Vérification des endpoints (front + API)
  console.log("\n4. Vérification des endpoints...");
  const getStatus = (port, path) =>
    new Promise((resolve) => {
      const req = http.request(
        { hostname: "localhost", port, path: path || "/", method: "GET", timeout: 5000 },
        (res) => resolve(res.statusCode)
      );
      req.on("error", () => resolve(0));
      req.end();
    });
  const pokerRoot = await getStatus(3000, "/");
  const bettingRoot = await getStatus(3001, "/");
  const pokerApi = await getStatus(3000, "/api/auth/me");
  const ok = (code) => code >= 200 && code < 400;
  console.log("   Poker (3000) /:", ok(pokerRoot) ? "OK" : "code " + pokerRoot);
  console.log("   Betting (3001) /:", ok(bettingRoot) ? "OK" : "code " + bettingRoot);
  console.log("   API (3000) /api/auth/me:", pokerApi === 401 || ok(pokerApi) ? "OK" : "code " + pokerApi);
  if (!ok(pokerRoot) || !ok(bettingRoot)) {
    console.error("Au moins un front ne répond pas correctement.");
    await run("docker", ["compose", "-f", COMPOSE_FILE, "down"], { env: TEST_ENV });
    process.exit(1);
  }

  // 5. Arrêt
  console.log("\n5. Arrêt du stack...");
  await run("docker", ["compose", "-f", COMPOSE_FILE, "down"], { env: TEST_ENV });

  console.log("\n=== Test de déploiement Docker réussi ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
