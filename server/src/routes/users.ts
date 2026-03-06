import fs from "fs";
import path from "path";
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../auth.js";
import { computeUserBadges } from "../badges.js";

const prisma = new PrismaClient();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "avatars");
const AVATAR_URL_PREFIX = "/uploads/avatars/";
const MAX_AVATAR_SIZE = 20 * 1024 * 1024; // 20 Mo
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
export const usersRouter = Router();

// Liste des users (pour le dropdown de connexion) — public
usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  res.json(users);
});

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

usersRouter.get("/leaderboard", authMiddleware, async (_req, res) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);

  const entries = await prisma.ledgerEntry.findMany({
    select: { userId: true, amount: true, createdAt: true },
  });

   const usersWithLedgerEntries = new Set(entries.map((e) => e.userId));

   const sessionEntries = await prisma.sessionEntry.findMany({
     select: { userId: true },
   });
   const usersWithSessionEntries = new Set(sessionEntries.map((e) => e.userId));

  const balances: Record<string, number> = {};
  const balancesWeekAgo: Record<string, number> = {};
  for (const e of entries) {
    balances[e.userId] = (balances[e.userId] ?? 0) + e.amount;
    if (new Date(e.createdAt) <= weekAgo) {
      balancesWeekAgo[e.userId] = (balancesWeekAgo[e.userId] ?? 0) + e.amount;
    }
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, avatarUrl: true },
  });

  const withBalance = users.map((u: { id: string; name: string; role: string; avatarUrl: string | null }) => ({
    ...u,
    balance: balances[u.id] ?? 0,
    balanceWeekAgo: balancesWeekAgo[u.id] ?? 0,
  }));

  const sortedNow = [...withBalance].sort((a, b) => b.balance - a.balance);
  const sortedWeekAgo = [...withBalance].sort((a, b) => b.balanceWeekAgo - a.balanceWeekAgo);

  const rankWeekAgoByUserId: Record<string, number> = {};
  sortedWeekAgo.forEach((u, idx) => {
    rankWeekAgoByUserId[u.id] = idx + 1;
  });

  const filtered = sortedNow.filter((u) => {
    const hasActivity =
      usersWithLedgerEntries.has(u.id) || usersWithSessionEntries.has(u.id);
    return hasActivity || u.balance !== 0;
  });

  const leaderboardWithBadges = await Promise.all(
    filtered.map(async (u, idx) => {
      const badges = await computeUserBadges(prisma, u.id);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl ?? null,
        balance: u.balance,
        balanceDeltaWeek: u.balance - u.balanceWeekAgo,
        rankChange:
          rankWeekAgoByUserId[u.id] != null
            ? idx + 1 - rankWeekAgoByUserId[u.id]!
            : 0,
        badges,
      };
    }),
  );

  res.json(leaderboardWithBadges);
});

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

// Historique de la banque par session (pour le graphique) — basé sur SessionEntry (result - buyIn - rebuy) + solde initial ledger
usersRouter.get("/balance-history/:userId", authMiddleware, async (req, res) => {
  const userId = param(req, "userId");
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  const [sessions, sessionEntriesDetails, ledgerSum] = await Promise.all([
    prisma.session.findMany({
      where: { status: "closed", closedAt: { not: null } },
      orderBy: { closedAt: "asc" },
      select: { id: true, name: true, closedAt: true },
    }),
    prisma.sessionEntry.findMany({
      where: { userId },
      select: { sessionId: true, buyIn: true, rebuy: true, result: true },
    }),
    prisma.ledgerEntry
      .aggregate({
        where: { userId },
        _sum: { amount: true },
      })
      .then((r) => r._sum.amount ?? 0),
  ]);
  const netBySessionId = new Map(
    sessionEntriesDetails.map((e) => [e.sessionId, Number(e.result) - Number(e.buyIn) - Number(e.rebuy)]),
  );
  const participantSessionIds = new Set(sessionEntriesDetails.map((e) => e.sessionId));
  const totalNetFromSessions = sessionEntriesDetails.reduce(
    (s, e) => s + (Number(e.result) - Number(e.buyIn) - Number(e.rebuy)),
    0,
  );
  const initialBalance = Number(ledgerSum) - totalNetFromSessions;
  const points: { date: string; balance: number; sessionId: string; sessionName: string | null }[] = [];
  let runningNet = 0;

  for (const session of sessions) {
    if (!session.closedAt || !participantSessionIds.has(session.id)) continue;
    const closedAtMs = new Date(session.closedAt).getTime();

    if (points.length === 0) {
      points.push({
        date: new Date(closedAtMs - 1).toISOString(),
        balance: initialBalance,
        sessionId: session.id,
        sessionName: null,
      });
    }

    const net = netBySessionId.get(session.id) ?? 0;
    runningNet += net;
    points.push({
      date: session.closedAt!.toISOString(),
      balance: initialBalance + runningNet,
      sessionId: session.id,
      sessionName: session.name ?? null,
    });
  }
  res.json({ points });
});

// Solde actuel d'un utilisateur (somme des ledger entries)
async function getCurrentBalance(userId: string): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    select: { amount: true },
  });
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// Badges d'un utilisateur (rétroactifs)
usersRouter.get("/:userId/badges", authMiddleware, async (req, res) => {
  const userId = param(req, "userId");
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  const badges = await computeUserBadges(prisma, userId);
  res.json({ badges });
});

// Profil public (avatar, bio, solde actuel) — connecté
usersRouter.get("/:userId/profile", authMiddleware, async (req, res) => {
  const userId = param(req, "userId");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, avatarUrl: true, bio: true },
  });
  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable." });
    return;
  }
  const [balance, badges] = await Promise.all([
    getCurrentBalance(userId),
    computeUserBadges(prisma, userId),
  ]);
  res.json({
    user: { ...user, avatarUrl: user.avatarUrl ?? null, bio: user.bio ?? null },
    balance,
    badges,
  });
});

// Upload photo de profil (base64)
usersRouter.post("/me/avatar", authMiddleware, async (req, res) => {
  const me = (req as { user?: { id: string } }).user;
  if (!me?.id) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  const { image } = req.body as { image?: string };
  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    res.status(400).json({ error: "Image requise (data URL base64)." });
    return;
  }
  const [header, base64] = image.split(",", 2);
  const mimeMatch = header?.match(/data:image\/(\w+)/);
  const mime = mimeMatch ? `image/${mimeMatch[1].toLowerCase()}` : null;
  if (!mime || !ALLOWED_MIMES.includes(mime as (typeof ALLOWED_MIMES)[number])) {
    res.status(400).json({ error: "Format d'image non autorisé (JPEG, PNG, WebP, GIF)." });
    return;
  }
  const buf = Buffer.from(base64!, "base64");
  if (buf.length > MAX_AVATAR_SIZE) {
    res.status(400).json({ error: "Image trop lourde (max 20 Mo)." });
    return;
  }
  const ext = MIME_EXT[mime] ?? ".jpg";
  const filename = `${me.id}${ext}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  const avatarUrl = AVATAR_URL_PREFIX + filename;
  const user = await prisma.user.update({
    where: { id: me.id },
    data: { avatarUrl },
    select: { id: true, name: true, role: true, avatarUrl: true, bio: true },
  });
  res.json({ user: { ...user, avatarUrl: user.avatarUrl ?? null, bio: user.bio ?? null }, avatarUrl });
});

// Mise à jour de son propre profil (nom, bio, ou URL avatar)
usersRouter.patch("/me/profile", authMiddleware, async (req, res) => {
  const me = (req as { user?: { id: string } }).user;
  if (!me?.id) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  const { name, avatarUrl, bio } = req.body as { name?: string; avatarUrl?: string; bio?: string };
  const data: { name?: string; avatarUrl?: string | null; bio?: string | null } = {};
  if (name !== undefined && typeof name === "string" && name.trim().length > 0) data.name = name.trim();
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl === "" ? null : avatarUrl;
  if (bio !== undefined) data.bio = bio === "" ? null : bio;
  const user = await prisma.user.update({
    where: { id: me.id },
    data,
    select: { id: true, name: true, role: true, avatarUrl: true, bio: true },
  });
  res.json({ user: { ...user, avatarUrl: user.avatarUrl ?? null, bio: user.bio ?? null } });
});

