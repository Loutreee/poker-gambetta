import { createHash } from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../auth.js";
import { fetchSteamProfile } from "../steam.js";
import { parseFaceitMatchUrl, fetchFaceitMatchStats } from "../faceit.js";
import {
  BET_TYPES,
  getKillWinFactor,
  WIN_FACTORS,
  type BetType,
} from "../bettingConstants.js";

const prisma = new PrismaClient();
export const bettingRouter = Router();

bettingRouter.use(authMiddleware);

const createBetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Trop de paris. Réessaye dans une minute." },
});
const autosettleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Trop de tentatives de règlement auto. Réessaye dans une minute." },
});

function isKillian(req: { user?: { name?: string } }) {
  const user = req.user;
  return !!user && user.name === "Killian";
}

function paramId(req: { params: { id?: string | string[] } }): string {
  const p = req.params.id;
  return Array.isArray(p) ? (p[0] ?? "") : (p ?? "");
}
function paramMatchId(req: { params: { matchId?: string | string[] } }): string {
  const p = req.params.matchId;
  return Array.isArray(p) ? (p[0] ?? "") : (p ?? "");
}

// --- Players ArcMonkey ---

function isValidSteamProfileUrl(url: string): boolean {
  return /^https:\/\/steamcommunity\.com\/(profiles\/[a-zA-Z0-9]+|id\/[\w-]+)\/?$/.test(url.trim());
}

bettingRouter.get("/players", async (_req, res) => {
  const players = await prisma.arcMonkeyPlayer.findMany({
    orderBy: { name: "asc" },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      steamProfileUrl: p.steamProfileUrl ?? null,
      steamDisplayName: p.steamDisplayName ?? null,
      steamAvatarUrl: p.steamAvatarUrl ?? null,
      userId: p.userId ?? null,
      active: p.active,
      user: p.user ? { id: p.user.id, name: p.user.name, avatarUrl: p.user.avatarUrl } : null,
      avatarUrl: p.user?.avatarUrl ?? p.steamAvatarUrl ?? null,
    })),
  });
});

bettingRouter.post("/players", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const { name, steamProfileUrl, steamDisplayName, userId } = req.body as {
    name?: string;
    steamProfileUrl?: string;
    steamDisplayName?: string;
    userId?: string;
  };
  if (!steamProfileUrl || typeof steamProfileUrl !== "string" || !isValidSteamProfileUrl(steamProfileUrl)) {
    res.status(400).json({ error: "Lien du profil Steam requis (ex: https://steamcommunity.com/id/pseudo ou https://steamcommunity.com/profiles/76561198...)." });
    return;
  }
  const trimmedUrl = steamProfileUrl.trim();

  // Récupération pseudo + avatar via l'API Steam
  let steamDisplayNameFromApi: string | null = null;
  let steamAvatarUrlFromApi: string | null = null;
  try {
    const steamProfile = await fetchSteamProfile(trimmedUrl);
    if (steamProfile) {
      steamDisplayNameFromApi = steamProfile.personaname;
      steamAvatarUrlFromApi = steamProfile.avatarfull || null;
    }
  } catch {
    // on continue sans les infos Steam
  }

  let baseName: string | null = null;
  try {
    const url = new URL(trimmedUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) {
      baseName = decodeURIComponent(last);
    }
  } catch {
    // ignore, garder baseName null
  }

  const finalName =
    typeof name === "string" && name.trim().length >= 2
      ? name.trim()
      : steamDisplayNameFromApi && steamDisplayNameFromApi.trim().length >= 2
        ? steamDisplayNameFromApi.trim()
        : baseName && baseName.trim().length >= 2
          ? baseName.trim()
          : null;

  if (!finalName) {
    res.status(400).json({ error: "Impossible de déduire un pseudo depuis ce lien Steam. Ajoute un nom manuellement ou vérifie l’URL." });
    return;
  }

  const data: {
    name: string;
    steamProfileUrl: string;
    steamDisplayName?: string | null;
    steamAvatarUrl?: string | null;
    userId?: string | null;
  } = {
    name: finalName,
    steamProfileUrl: trimmedUrl,
    steamDisplayName:
      typeof steamDisplayName === "string" && steamDisplayName.trim()
        ? steamDisplayName.trim()
        : steamDisplayNameFromApi ?? baseName ?? finalName,
    steamAvatarUrl: steamAvatarUrlFromApi,
  };
  if (userId !== undefined && userId !== null && userId !== "") {
    data.userId = userId;
  }
  const player = await prisma.arcMonkeyPlayer.create({
    data,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.status(201).json({
    player: {
      id: player.id,
      name: player.name,
      steamProfileUrl: player.steamProfileUrl,
      steamDisplayName: player.steamDisplayName,
      steamAvatarUrl: player.steamAvatarUrl ?? null,
      userId: player.userId,
      active: player.active,
      user: player.user ? { id: player.user.id, name: player.user.name, avatarUrl: player.user.avatarUrl } : null,
      avatarUrl: player.user?.avatarUrl ?? player.steamAvatarUrl ?? null,
    },
  });
});

bettingRouter.patch("/players/:id", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  const { name, steamProfileUrl, steamDisplayName, userId, active } = req.body as {
    name?: string;
    steamProfileUrl?: string;
    steamDisplayName?: string;
    userId?: string | null;
    active?: boolean;
  };
  const data: {
    name?: string;
    steamProfileUrl?: string;
    steamDisplayName?: string | null;
    steamAvatarUrl?: string | null;
    userId?: string | null;
    active?: boolean;
  } = {};
  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: "Nom invalide (au moins 2 caractères)." });
      return;
    }
    data.name = name.trim();
  }
  if (steamProfileUrl !== undefined) {
    if (!steamProfileUrl || !isValidSteamProfileUrl(steamProfileUrl)) {
      res.status(400).json({ error: "Lien Steam invalide." });
      return;
    }
    const trimmedUrl = steamProfileUrl.trim();
    data.steamProfileUrl = trimmedUrl;
    // Rafraîchir pseudo + avatar depuis Steam quand l'URL change
    try {
      const steamProfile = await fetchSteamProfile(trimmedUrl);
      if (steamProfile) {
        data.steamDisplayName = steamProfile.personaname;
        data.steamAvatarUrl = steamProfile.avatarfull || null;
      }
    } catch {
      // ignorer
    }
  }
  if (steamDisplayName !== undefined) {
    data.steamDisplayName = typeof steamDisplayName === "string" && steamDisplayName.trim() ? steamDisplayName.trim() : null;
  }
  if (userId !== undefined) {
    data.userId = userId === "" || userId == null ? null : userId;
  }
  if (active !== undefined) {
    data.active = !!active;
  }
  const player = await prisma.arcMonkeyPlayer.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json({
    player: {
      id: player.id,
      name: player.name,
      steamProfileUrl: player.steamProfileUrl,
      steamDisplayName: player.steamDisplayName,
      steamAvatarUrl: player.steamAvatarUrl ?? null,
      userId: player.userId,
      active: player.active,
      user: player.user ? { id: player.user.id, name: player.user.name, avatarUrl: player.user.avatarUrl } : null,
      avatarUrl: player.user?.avatarUrl ?? player.steamAvatarUrl ?? null,
    },
  });
});

bettingRouter.delete("/players/:id", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  await prisma.matchPlayer.deleteMany({ where: { playerId: id } });
  await prisma.arcMonkeyPlayer.delete({ where: { id } });
  res.status(204).end();
});

// --- Matches ---

bettingRouter.get("/matches", async (req, res) => {
  const { status, fromDate, toDate, opponent } = req.query as {
    status?: string;
    fromDate?: string;
    toDate?: string;
    opponent?: string;
  };
  const where: {
    status?: string;
    scheduledAt?: { gte?: Date; lte?: Date };
    opponent?: { contains: string; mode: "insensitive" };
  } = {};
  if (status && ["upcoming", "finished", "cancelled"].includes(status)) where.status = status;
  const scheduledAt: { gte?: Date; lte?: Date } = {};
  if (fromDate && !Number.isNaN(Date.parse(fromDate))) scheduledAt.gte = new Date(fromDate);
  if (toDate && !Number.isNaN(Date.parse(toDate))) scheduledAt.lte = new Date(toDate);
  if (Object.keys(scheduledAt).length) where.scheduledAt = scheduledAt;
  if (opponent && opponent.trim()) {
    where.opponent = { contains: opponent.trim(), mode: "insensitive" };
  }
  const matches = await prisma.match.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { scheduledAt: "desc" },
    include: {
      players: {
        include: {
          player: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
  res.json({
    matches: matches.map((m) => ({
      id: m.id,
      title: m.title ?? null,
      opponent: m.opponent,
      format: m.format ?? "BO3",
      scheduledAt: m.scheduledAt,
      status: m.status,
      faceitMatchUrl: m.faceitMatchUrl ?? null,
      maxStakePerBet: m.maxStakePerBet ?? null,
      maxStakePerMatch: m.maxStakePerMatch ?? null,
      players: m.players.map((mp) => mp.player).map((p) => ({
        id: p.id,
        name: p.name,
        steamDisplayName: p.steamDisplayName ?? p.name,
        steamProfileUrl: p.steamProfileUrl ?? null,
        avatarUrl: p.user?.avatarUrl ?? p.steamAvatarUrl ?? null,
        userName: p.user?.name ?? null,
      })),
    })),
  });
});

bettingRouter.get("/matches/next", async (_req, res) => {
  const match = await prisma.match.findFirst({
    where: { status: "upcoming" },
    orderBy: { scheduledAt: "asc" },
    include: {
      players: {
        include: {
          player: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
  if (!match) {
    res.json({ match: null });
    return;
  }
  const now = new Date();
  const isLive = match.scheduledAt <= now;
  res.json({
    match: {
      id: match.id,
      title: match.title ?? null,
      opponent: match.opponent,
      format: match.format ?? "BO3",
      scheduledAt: match.scheduledAt,
      status: match.status,
      faceitMatchUrl: match.faceitMatchUrl ?? null,
      isLive,
      players: match.players
        .map((mp) => mp.player)
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          steamDisplayName: p.steamDisplayName ?? p.name,
          steamProfileUrl: p.steamProfileUrl ?? null,
          avatarUrl: p.user?.avatarUrl ?? p.steamAvatarUrl ?? null,
          userName: p.user?.name ?? null,
        })),
    },
  });
});

const VALID_FORMATS = ["BO1", "BO3", "BO5"] as const;

bettingRouter.post("/matches", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const { title, opponent, format, scheduledAt, playerIds, faceitMatchUrl, maxStakePerBet, maxStakePerMatch } =
    req.body as {
      title?: string;
      opponent?: string;
      format?: string;
      scheduledAt?: string;
      playerIds?: string[];
      faceitMatchUrl?: string | null;
      maxStakePerBet?: number | null;
      maxStakePerMatch?: number | null;
    };
  if (!opponent || typeof opponent !== "string" || opponent.trim().length < 2) {
    res.status(400).json({ error: "Nom de l'équipe adverse invalide." });
    return;
  }
  const formatVal = (typeof format === "string" && VALID_FORMATS.includes(format as any)) ? format : "BO3";
  if (!scheduledAt || typeof scheduledAt !== "string" || Number.isNaN(Date.parse(scheduledAt))) {
    res.status(400).json({ error: "Date/heure de match invalide." });
    return;
  }
  const playersArray = Array.isArray(playerIds) ? playerIds : [];
  if (playersArray.length === 0) {
    res.status(400).json({ error: "Au moins un joueur ArcMonkey doit être sélectionné." });
    return;
  }

  const date = new Date(scheduledAt);

  const faceitUrlVal =
    typeof faceitMatchUrl === "string" && faceitMatchUrl.trim()
      ? faceitMatchUrl.trim()
      : null;

  const match = await prisma.$transaction(async (tx) => {
    const m = await tx.match.create({
      data: {
        title: typeof title === "string" && title.trim() ? title.trim() : null,
        opponent: opponent.trim(),
        format: formatVal,
        scheduledAt: date,
        faceitMatchUrl: faceitUrlVal,
        maxStakePerBet:
          maxStakePerBet != null && Number.isInteger(maxStakePerBet) && maxStakePerBet >= 0
            ? maxStakePerBet
            : null,
        maxStakePerMatch:
          maxStakePerMatch != null && Number.isInteger(maxStakePerMatch) && maxStakePerMatch >= 0
            ? maxStakePerMatch
            : null,
      },
    });

    const uniquePlayerIds = [...new Set(playersArray)];
    await tx.matchPlayer.createMany({
      data: uniquePlayerIds.map((playerId) => ({
        matchId: m.id,
        playerId,
      })),
      skipDuplicates: true,
    });

    return m;
  });

  res.status(201).json({ matchId: match.id });
});

bettingRouter.patch("/matches/:id", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  const { title, opponent, format, status, scheduledAt, playerIds, faceitMatchUrl, maxStakePerBet, maxStakePerMatch } =
    req.body as {
      title?: string | null;
      opponent?: string;
      format?: string;
      status?: string;
      scheduledAt?: string;
      playerIds?: string[];
      faceitMatchUrl?: string | null;
      maxStakePerBet?: number | null;
      maxStakePerMatch?: number | null;
    };

  const validStatuses = ["upcoming", "finished", "cancelled"] as const;
  const statusVal = status !== undefined && typeof status === "string" && validStatuses.includes(status as any) ? status : undefined;

  if (opponent !== undefined && (typeof opponent !== "string" || opponent.trim().length < 2)) {
    res.status(400).json({ error: "Nom de l'équipe adverse invalide." });
    return;
  }
  if (scheduledAt !== undefined && (typeof scheduledAt !== "string" || Number.isNaN(Date.parse(scheduledAt)))) {
    res.status(400).json({ error: "Date/heure de match invalide." });
    return;
  }

  const date = scheduledAt ? new Date(scheduledAt) : undefined;
  const playersArray = Array.isArray(playerIds) ? playerIds : undefined;
  const formatVal = format !== undefined && typeof format === "string" && VALID_FORMATS.includes(format as any) ? format : undefined;

  await prisma.$transaction(async (tx) => {
    if (playersArray && playersArray.length > 0) {
      await tx.matchPlayer.deleteMany({ where: { matchId: id } });
      const uniquePlayerIds = [...new Set(playersArray)];
      await tx.matchPlayer.createMany({
        data: uniquePlayerIds.map((playerId) => ({
          matchId: id,
          playerId,
        })),
        skipDuplicates: true,
      });
    }

    const data: {
      title?: string | null;
      opponent?: string;
      format?: string;
      status?: string;
      scheduledAt?: Date;
      faceitMatchUrl?: string | null;
      maxStakePerBet?: number | null;
      maxStakePerMatch?: number | null;
    } = {};
    if (title !== undefined) data.title = typeof title === "string" && title.trim() ? title.trim() : null;
    if (opponent !== undefined) data.opponent = opponent.trim();
    if (formatVal) data.format = formatVal;
    if (statusVal) data.status = statusVal;
    if (date) data.scheduledAt = date;
    if (faceitMatchUrl !== undefined) {
      data.faceitMatchUrl =
        typeof faceitMatchUrl === "string" && faceitMatchUrl.trim() ? faceitMatchUrl.trim() : null;
    }
    if (maxStakePerBet !== undefined) {
      data.maxStakePerBet =
        maxStakePerBet != null && Number.isInteger(maxStakePerBet) && maxStakePerBet >= 0
          ? maxStakePerBet
          : null;
    }
    if (maxStakePerMatch !== undefined) {
      data.maxStakePerMatch =
        maxStakePerMatch != null && Number.isInteger(maxStakePerMatch) && maxStakePerMatch >= 0
          ? maxStakePerMatch
          : null;
    }

    if (Object.keys(data).length > 0) {
      await tx.match.update({
        where: { id },
        data,
      });
    }
  });

  res.json({ ok: true });
});

bettingRouter.delete("/matches/:id", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  await prisma.matchPlayer.deleteMany({ where: { matchId: id } });
  await prisma.match.delete({ where: { id } });
  res.status(204).end();
});

// --- Match by id (pour la page paris) ---
bettingRouter.get("/matches/:id", async (req, res) => {
  const id = req.params.id;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          player: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
  if (!match) {
    res.status(404).json({ error: "Match introuvable." });
    return;
  }
  const isLive = match.scheduledAt <= new Date();
  res.json({
    match: {
      id: match.id,
      title: match.title ?? null,
      opponent: match.opponent,
      format: match.format ?? "BO3",
      scheduledAt: match.scheduledAt,
      status: match.status,
      faceitMatchUrl: match.faceitMatchUrl ?? null,
      isLive,
      players: match.players
        .map((mp) => mp.player)
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          steamDisplayName: p.steamDisplayName ?? p.name,
          steamProfileUrl: p.steamProfileUrl ?? null,
          avatarUrl: p.user?.avatarUrl ?? p.steamAvatarUrl ?? null,
          userName: p.user?.name ?? null,
        })),
    },
  });
});

// --- Balance utilisateur (somme des ledger entries) ---
async function getUserBalance(userId: string): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    select: { amount: true },
  });
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// --- Mises en attente (paris PENDING) — pour solde disponible ---
async function getPendingStakes(userId: string): Promise<number> {
  const r = await prisma.bet.aggregate({
    where: { userId, status: "PENDING" },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

function payloadGroupKey(betType: string, payload: object): string {
  const canonical = JSON.stringify(
    typeof payload === "object" && payload !== null
      ? Object.keys(payload)
          .sort()
          .reduce((acc: Record<string, unknown>, k) => {
            acc[k] = (payload as Record<string, unknown>)[k];
            return acc;
          }, {})
      : {},
  );
  return createHash("sha256").update(betType + ":" + canonical).digest("hex").slice(0, 16);
}

// --- Paris ---
// PLAYER_RANK reste en base pour d'anciens paris ; les nouveaux types sont dans bettingConstants.

/** Historique des paris de l'utilisateur connecté (tous matchs, avec gain calculé pour WON/LOST). */
bettingRouter.get("/me/bets", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: "Non connecté." });
    return;
  }
  const bets = await prisma.bet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      match: {
        select: {
          id: true,
          title: true,
          opponent: true,
          format: true,
          scheduledAt: true,
          status: true,
        },
      },
    },
  });
  const list = bets.map((b) => {
    const factor = WIN_FACTORS[b.betType as BetType] ?? 2;
    const gain =
      b.status === "WON" ? Math.round(factor * b.amount) - b.amount : b.status === "LOST" ? -b.amount : null;
    return {
      id: b.id,
      matchId: b.matchId,
      amount: b.amount,
      betType: b.betType,
      payload: b.payload,
      status: b.status,
      createdAt: b.createdAt,
      match: b.match
        ? {
            id: b.match.id,
            title: b.match.title ?? null,
            opponent: b.match.opponent,
            format: b.match.format ?? "BO3",
            scheduledAt: b.match.scheduledAt,
            status: b.match.status,
          }
        : null,
      gain,
    };
  });
  res.json({ bets: list });
});

bettingRouter.get("/matches/:matchId/bets", async (req, res) => {
  const matchId = req.params.matchId;
  const bets = await prisma.bet.findMany({
    where: { matchId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
  res.json({
    bets: bets.map((b) => ({
      id: b.id,
      matchId: b.matchId,
      userId: b.userId,
      amount: b.amount,
      betType: b.betType,
      payload: b.payload,
      status: b.status,
      createdAt: b.createdAt,
      user: b.user,
    })),
  });
});

bettingRouter.post("/matches/:matchId/bets", createBetLimiter, async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: "Non connecté." });
    return;
  }
  const matchId = paramMatchId(req);
  if (!matchId) {
    res.status(400).json({ error: "matchId manquant." });
    return;
  }
  const { amount, betType, payload } = req.body as {
    amount?: number;
    betType?: string;
    payload?: Record<string, unknown>;
  };
  if (typeof amount !== "number" || amount < 1) {
    res.status(400).json({ error: "Montant invalide (entier positif)." });
    return;
  }
  if (!betType || !BET_TYPES.includes(betType as BetType)) {
    res.status(400).json({ error: "Type de pari invalide." });
    return;
  }
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ error: "Payload invalide." });
    return;
  }
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      maxStakePerBet: true,
      maxStakePerMatch: true,
    },
  });
  if (!match) {
    res.status(404).json({ error: "Match introuvable." });
    return;
  }
  if (match.status !== "upcoming") {
    res.status(400).json({ error: "Les paris sont fermés pour ce match." });
    return;
  }
  if (match.scheduledAt <= new Date()) {
    res.status(400).json({ error: "Les paris sont fermés (match déjà commencé)." });
    return;
  }
  const maxPerBet = match.maxStakePerBet ?? undefined;
  if (maxPerBet != null && maxPerBet > 0 && amount > maxPerBet) {
    res.status(400).json({ error: `La mise maximale par pari pour ce match est de ${maxPerBet} $.` });
    return;
  }
  const newGroupKey = payloadGroupKey(betType, payload as object);
  const existingBets = await prisma.bet.findMany({
    where: { matchId, userId: user.id, status: "PENDING" },
    select: { betType: true, payload: true, amount: true },
  });
  for (const b of existingBets) {
    if (payloadGroupKey(b.betType, b.payload as object) === newGroupKey) {
      res.status(400).json({ error: "Tu as déjà un pari en cours sur cette même situation." });
      return;
    }
  }
  const maxPerMatch = match.maxStakePerMatch ?? undefined;
  if (maxPerMatch != null && maxPerMatch > 0) {
    const userStakeOnMatch = existingBets.reduce((sum, b) => sum + b.amount, 0) + amount;
    if (userStakeOnMatch > maxPerMatch) {
      res.status(400).json({ error: `La mise totale maximale pour ce match est de ${maxPerMatch} $.` });
      return;
    }
  }
  const [balance, pendingStakes] = await Promise.all([
    getUserBalance(user.id),
    getPendingStakes(user.id),
  ]);
  const availableBalance = balance - pendingStakes;
  if (availableBalance < amount) {
    res.status(400).json({ error: "Solde disponible insuffisant (solde moins paris en cours)." });
    return;
  }
  await prisma.bet.create({
    data: {
      matchId,
      userId: user.id,
      amount,
      betType,
      payload: payload as object,
    },
  });
  res.status(201).json({ ok: true });
});

bettingRouter.delete("/matches/:matchId/bets/:betId", async (req, res) => {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: "Non connecté." });
    return;
  }
  const { matchId, betId } = req.params;
  const bet = await prisma.bet.findFirst({
    where: { id: betId, matchId, userId: user.id },
  });
  if (!bet) {
    res.status(404).json({ error: "Pari introuvable." });
    return;
  }
  if (bet.status !== "PENDING") {
    res.status(400).json({ error: "Seuls les paris en cours peuvent être annulés." });
    return;
  }
  await prisma.bet.update({
    where: { id: betId },
    data: { status: "CANCELLED" },
  });
  res.status(204).end();
});

// --- Libellé court pour la note ledger (règlement), avec nom du joueur si pertinent ---
function getBetNoteLabel(
  betType: string,
  payload: object,
  getPlayerName?: (playerId: string) => string | null,
): string {
  const p = payload as Record<string, unknown>;
  const playerId = typeof p?.playerId === "string" ? p.playerId : null;
  const playerName = playerId && getPlayerName ? getPlayerName(playerId) : null;
  const namePart = playerName ? ` (${playerName})` : "";
  switch (betType) {
    case "VICTORY":
      return p?.outcome === "loss" ? "défaite ArcMonkey" : "victoire ArcMonkey";
    case "KILLS": {
      const thr = String(p?.threshold ?? "");
      return `nombre de kills (${thr})${namePart}`;
    }
    case "ACE":
      return `ACE${namePart}`;
    case "QUAD_KILL":
      return `quadruple kill${namePart}`;
    case "MOST_KILLS":
      return `meilleur killer (plus de kills)${namePart}`;
    case "EXACT_SCORE": {
      const arc = typeof p?.scoreArcMonkey === "number" ? p.scoreArcMonkey : Number(p?.scoreArcMonkey);
      const opp = typeof p?.scoreOpponent === "number" ? p.scoreOpponent : Number(p?.scoreOpponent);
      if (Number.isNaN(arc) || Number.isNaN(opp)) return "score exact";
      return `score exact (${arc}-${opp})`;
    }
    default:
      return betType.toLowerCase();
  }
}

// --- Règlement des paris (admin) ---
bettingRouter.get("/matches/:id/settlement", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          player: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
  if (!match) {
    res.status(404).json({ error: "Match introuvable." });
    return;
  }
  const bets = await prisma.bet.findMany({
    where: { matchId: id },
    include: { user: { select: { id: true, name: true } } },
  });
  const groups = new Map<
    string,
    { key: string; betType: string; payload: object; bets: { id: string; userId: string; amount: number; userName: string; status: string }[] }
  >();
  for (const b of bets) {
    const key = payloadGroupKey(b.betType, b.payload as object);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        betType: b.betType,
        payload: b.payload as object,
        bets: [],
      });
    }
    groups.get(key)!.bets.push({
      id: b.id,
      userId: b.userId,
      amount: b.amount,
      userName: b.user.name,
      status: b.status,
    });
  }
  // Ne retourner que les groupes qui ont au moins un pari PENDING (à régler)
  const pendingGroups = Array.from(groups.values()).filter((g) => g.bets.some((b) => b.status === "PENDING"));
  const players = match.players
    .map((mp) => mp.player)
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      steamDisplayName: p.steamDisplayName ?? p.name,
      steamProfileUrl: p.steamProfileUrl ?? null,
      avatarUrl: p.user?.avatarUrl ?? p.steamAvatarUrl ?? null,
      userName: p.user?.name ?? null,
    }));

  res.json({
    match: {
      id: match.id,
      title: match.title ?? null,
      opponent: match.opponent,
      format: match.format ?? "BO3",
      scheduledAt: match.scheduledAt,
      status: match.status,
      players,
    },
    outcomeGroups: pendingGroups.map((g) => ({
      key: g.key,
      betType: g.betType,
      payload: g.payload,
      bets: g.bets.map(({ id, userId, amount, userName }) => ({ id, userId, amount, userName })),
    })),
  });
});

async function settleMatchWithResults(
  matchId: string,
  results: Record<string, "won" | "lost">,
  adminUserId: string,
  options?: { killWinFactors?: Record<string, number> },
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      players: {
        include: {
          player: { select: { id: true, name: true, steamDisplayName: true } },
        },
      },
    },
  });
  if (!match) {
    throw new Error("Match introuvable.");
  }
  const playerNames = new Map<string, string>();
  for (const mp of match.players) {
    const name = mp.player.steamDisplayName ?? mp.player.name;
    playerNames.set(mp.player.id, name);
  }
  const getPlayerName = (playerId: string) => playerNames.get(playerId) ?? null;

  const bets = await prisma.bet.findMany({ where: { matchId } });
  const pending = bets.filter((b) => b.status === "PENDING");
  if (pending.length === 0) {
    throw new Error("Aucun pari en attente à régler.");
  }
  const matchDateStr = new Date(match.scheduledAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  await prisma.$transaction(async (tx) => {
    for (const bet of pending) {
      const key = payloadGroupKey(bet.betType, bet.payload as object);
      const result = results[key];
      if (result !== "won" && result !== "lost") continue;
      const status = result === "won" ? "WON" : "LOST";
      await tx.bet.update({
        where: { id: bet.id },
        data: { status },
      });
      // Une seule entrée ledger par pari. On applique un multiplicateur de gain
      // en fonction du type de pari. Perdu = -mise.
      // Les facteurs ci-dessous sont calibrés pour rester “fun” mais à peu près cohérents
      // avec la rareté attendue de chaque pari (légère edge maison).
      const defaultFactor = WIN_FACTORS[bet.betType as BetType] ?? 2;
      const winFactor =
        bet.betType === "KILLS" ? (options?.killWinFactors?.[key] ?? defaultFactor) : defaultFactor;
      switch (bet.betType) {
        case "VICTORY":
        case "EXACT_SCORE":
        case "KILLS":
        case "ACE":
        case "QUAD_KILL":
          // Quadruple kill encore un cran au‑dessus d’un ACE (en pratique)
          break;
        case "MOST_KILLS":
          break;
      }
      const amount = result === "won" ? Math.round(winFactor * bet.amount) : -bet.amount;
      const label = getBetNoteLabel(bet.betType, bet.payload as object, getPlayerName);
      const note = `Pari sur ${label} du match du ${matchDateStr}`;
      await tx.ledgerEntry.create({
        data: {
          userId: bet.userId,
          amount,
          note,
          createdBy: adminUserId,
        },
      });
    }
  });
}

bettingRouter.post("/matches/:id/settle", async (req, res) => {
  const adminUser = (req as any).user;
  if (!isKillian(req as any) || !adminUser?.id) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = req.params.id;
  const { results } = req.body as { results?: Record<string, "won" | "lost"> };
  if (!results || typeof results !== "object") {
    res.status(400).json({ error: "results requis (objet groupKey -> won|lost)." });
    return;
  }

  try {
    await settleMatchWithResults(id, results, adminUser.id);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message || "Erreur lors du règlement." });
    return;
  }

  res.json({ ok: true });
});

// Règlement automatique depuis un lien Faceit
bettingRouter.post("/matches/:id/autosettle-from-faceit", autosettleLimiter, async (req, res) => {
  const adminUser = (req as any).user;
  if (!isKillian(req as any) || !adminUser?.id) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const id = paramId(req);
  if (!id) {
    res.status(400).json({ error: "id match manquant." });
    return;
  }
  const { url } = req.body as { url?: string };

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          player: true,
        },
      },
    },
  });
  if (!match) {
    res.status(404).json({ error: "Match introuvable." });
    return;
  }

  const faceitUrl = (url && url.trim()) || match.faceitMatchUrl || "";
  if (!faceitUrl) {
    res.status(400).json({ error: "Aucune URL Faceit fournie (ni stockée sur le match)." });
    return;
  }

  const matchId = parseFaceitMatchUrl(faceitUrl);
  if (!matchId) {
    res.status(400).json({ error: "URL Faceit invalide ou impossible à parser." });
    return;
  }

  // eslint-disable-next-line no-console
  console.log("[BETTING][FACEIT] autosettle-from-faceit", {
    matchId: id,
    faceitUrl,
    parsedMatchId: matchId,
  });

  // On mémorise l'URL sur le match si elle n'était pas encore stockée.
  if (!match.faceitMatchUrl) {
    await prisma.match.update({
      where: { id },
      data: { faceitMatchUrl: faceitUrl },
    });
  }

  let stats: Awaited<ReturnType<typeof fetchFaceitMatchStats>>;
  try {
    stats = await fetchFaceitMatchStats(matchId, "ArcMonkey", match.opponent);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("[BETTING][FACEIT] autosettle fetch error", { matchId: id, err });
    res.status(503).json({
      error:
        "Stats Faceit pas encore disponibles ou API injoignable. Réessayer dans quelques minutes.",
    });
    return;
  }
  if (!stats || stats.winner === "unknown") {
    // eslint-disable-next-line no-console
    console.log("[BETTING][FACEIT] stats not usable", { matchId: id, hasStats: !!stats });
    res.status(400).json({
      error:
        "Impossible de déduire le résultat du match depuis Faceit (match non terminé ou stats manquantes). Réessayer plus tard.",
    });
    return;
  }

  const bets = await prisma.bet.findMany({
    where: { matchId: id },
    select: {
      id: true,
      betType: true,
      payload: true,
      status: true,
    },
  });

  // Préparer un mapping joueur ArcMonkey -> stats Faceit (kills, pentaKills)
  const arcPlayers = match.players
    .map((mp) => mp.player)
    .filter((p) => p.active);

  const faceitPlayers = stats.players;
  const arcPlayerStats = new Map<
    string,
    { kills: number; pentaKills: number; quadKills: number; rws: number }
  >();

  for (const arc of arcPlayers) {
    const displayName = (arc.steamDisplayName ?? arc.name).toLowerCase();
    if (!displayName) continue;
    const fp = faceitPlayers.find((pl) => {
      const nick = (pl.nickname ?? "").toLowerCase();
      return nick === displayName || nick.includes(displayName) || displayName.includes(nick);
    });
    if (fp) {
      arcPlayerStats.set(arc.id, {
        kills: fp.kills,
        pentaKills: fp.pentaKills,
        quadKills: fp.quadKills,
        rws: fp.rws,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("[BETTING][FACEIT] mapped players", {
    arcCount: arcPlayers.length,
    mappedCount: arcPlayerStats.size,
    stats: arcPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      steamDisplayName: p.steamDisplayName,
      rws: arcPlayerStats.get(p.id)?.rws ?? null,
      kills: arcPlayerStats.get(p.id)?.kills ?? null,
      pentaKills: arcPlayerStats.get(p.id)?.pentaKills ?? null,
      quadKills: arcPlayerStats.get(p.id)?.quadKills ?? null,
    })),
  });

  // Pré-calcul pour les paris MOST_KILLS : meilleur killer unique parmi ArcMonkey
  let mostKillsWinnerId: string | null = null;
  let mostKillsValue = -1;
  let mostKillsTie = false;
  for (const [id, st] of arcPlayerStats.entries()) {
    if (st.kills > mostKillsValue) {
      mostKillsValue = st.kills;
      mostKillsWinnerId = id;
      mostKillsTie = false;
    } else if (st.kills === mostKillsValue && mostKillsValue >= 0) {
      // égalité pour le meilleur nombre de kills → on considérera que le pari est perdu
      mostKillsTie = true;
    }
  }

  // On part d'une map vide et on remplit uniquement pour les types qu'on sait interpréter
  const results: Record<string, "won" | "lost"> = {};
  const killWinFactors: Record<string, number> = {};

  for (const b of bets) {
    if (b.status !== "PENDING") continue;
    const key = payloadGroupKey(b.betType, b.payload as object);

    if (b.betType === "VICTORY") {
      const p = b.payload as Record<string, unknown>;
      const outcome = (p.outcome === "loss" ? "loss" : "win") as "win" | "loss";
      let betWon: boolean | null = null;
      if (stats.winner === "arc") {
        // ArcMonkey a gagné
        betWon = outcome === "win";
      } else if (stats.winner === "opp") {
        // ArcMonkey a perdu
        betWon = outcome === "loss";
      }
      if (betWon != null) {
        results[key] = betWon ? "won" : "lost";
      }
    } else if (b.betType === "EXACT_SCORE") {
      const p = b.payload as Record<string, unknown>;
      const expArc = typeof p.scoreArcMonkey === "number" ? p.scoreArcMonkey : Number(p.scoreArcMonkey ?? NaN);
      const expOpp = typeof p.scoreOpponent === "number" ? p.scoreOpponent : Number(p.scoreOpponent ?? NaN);
      if (!Number.isNaN(expArc) && !Number.isNaN(expOpp)) {
        results[key] = stats.scoreArc === expArc && stats.scoreOpp === expOpp ? "won" : "lost";
      }
    } else if (b.betType === "KILLS") {
      const p = b.payload as Record<string, unknown>;
      const playerId = typeof p.playerId === "string" ? p.playerId : null;
      const threshold = String(p.threshold ?? "");
      if (!playerId) continue;
      const s = arcPlayerStats.get(playerId);
      if (!s) continue;
      const kills = s.kills; // total de kills sur le BO (déjà agrégé par Faceit)
      if (threshold === "<15") {
        results[key] = kills < 15 ? "won" : "lost";
      } else if (threshold === ">15") {
        results[key] = kills > 15 ? "won" : "lost";
      } else if (threshold === ">30") {
        results[key] = kills > 30 ? "won" : "lost";
      } else if (threshold === ">50") {
        results[key] = kills > 50 ? "won" : "lost";
      } else if (threshold === ">60") {
        results[key] = kills > 60 ? "won" : "lost";
      } else if (threshold === ">70") {
        results[key] = kills > 70 ? "won" : "lost";
      } else {
        continue;
      }
      killWinFactors[key] = getKillWinFactor(kills);
    } else if (b.betType === "ACE") {
      const p = b.payload as Record<string, unknown>;
      const playerId = typeof p.playerId === "string" ? p.playerId : null;
      if (!playerId) continue;
      const s = arcPlayerStats.get(playerId);
      if (!s) continue;
      results[key] = s.pentaKills > 0 ? "won" : "lost";
    } else if (b.betType === "QUAD_KILL") {
      const p = b.payload as Record<string, unknown>;
      const playerId = typeof p.playerId === "string" ? p.playerId : null;
      if (!playerId) continue;
      const s = arcPlayerStats.get(playerId);
      if (!s) continue;
      // Quadruple kill : au moins un round avec 4 kills (champ Quad/Quadro dans Faceit)
      results[key] = s.quadKills > 0 ? "won" : "lost";
    } else if (b.betType === "MOST_KILLS") {
      const p = b.payload as Record<string, unknown>;
      const playerId = typeof p.playerId === "string" ? p.playerId : null;
      if (!playerId) continue;
      // Si on n'a pas de meilleur killer unique, on perd tous les paris MOST_KILLS
      if (!mostKillsWinnerId || mostKillsTie) {
        results[key] = "lost";
      } else {
        results[key] = playerId === mostKillsWinnerId ? "won" : "lost";
      }
    } else if (b.betType === "PLAYER_RANK") {
      const p = b.payload as Record<string, unknown>;
      const playerId = typeof p.playerId === "string" ? p.playerId : null;
      const expectedRankRaw = p.rank;
      const expectedRank =
        typeof expectedRankRaw === "number" ? expectedRankRaw : Number(expectedRankRaw ?? NaN);
      if (!playerId || Number.isNaN(expectedRank)) continue;
      const s = arcPlayerStats.get(playerId);
      if (!s) continue;

      const statsArray = Array.from(arcPlayerStats.entries()).map(([id, st]) => ({
        id,
        rws: st.rws,
        kills: st.kills,
      }));
      const hasNonZeroRws = statsArray.some((st) => st.rws > 0);

      // Si on n'a aucun RWS côté API, on ne tente PAS d'automatiser le classement,
      // pour ne pas diverger du scoreboard CS qui se base sur un calcul différent.
      if (!hasNonZeroRws) {
        // eslint-disable-next-line no-console
        console.log("[BETTING][FACEIT] player rank skipped (no RWS available)", {
          matchId: id,
          stats: statsArray,
        });
        continue;
      }

      // Construire le classement dashboard CS : priorité au RWS, puis kills en cas d'égalité
      const ranked = statsArray.sort((a, b) => {
        if (b.rws !== a.rws) return b.rws - a.rws;
        // fallback kills si RWS égal
        return b.kills - a.kills;
      });

      // eslint-disable-next-line no-console
      console.log("[BETTING][FACEIT] player rank ranking", {
        matchId: id,
        hasNonZeroRws,
        ranked: ranked.map((r, idx) => ({
          rank: idx + 1,
          id: r.id,
          rws: r.rws,
          kills: r.kills,
        })),
      });

      const index = ranked.findIndex((r) => r.id === playerId);
      if (index === -1) continue;
      const actualRank = index + 1;
      results[key] = actualRank === expectedRank ? "won" : "lost";
    }
  }

  if (Object.keys(results).length === 0) {
    // eslint-disable-next-line no-console
    console.log("[BETTING][FACEIT] no automatic results computed", { matchId: id });
    res.status(400).json({ error: "Aucun pari automatique à régler (types non gérés ou aucun pari en attente)." });
    return;
  }

  try {
    await settleMatchWithResults(id, results, adminUser.id, { killWinFactors });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message || "Erreur lors du règlement automatique." });
    return;
  }

  res.json({ ok: true });
});

// Debug Faceit : ne touche à aucun pari, juste retourne les infos récupérées
bettingRouter.post("/matches/faceit-debug", async (req, res) => {
  if (!isKillian(req as any)) {
    res.status(403).json({ error: "Accès réservé à Killian." });
    return;
  }
  const { url } = req.body as { url?: string };
  if (!url || !url.trim()) {
    res.status(400).json({ error: "URL Faceit requise." });
    return;
  }
  const matchId = parseFaceitMatchUrl(url);
  if (!matchId) {
    res.status(400).json({ error: "URL Faceit invalide ou impossible à parser." });
    return;
  }

  // eslint-disable-next-line no-console
  console.log("[BETTING][FACEIT][DEBUG] faceit-debug", { url, matchId });

  const stats = await fetchFaceitMatchStats(matchId, "ArcMonkey");
  if (!stats) {
    res.status(400).json({ error: "Impossible de récupérer les stats Faceit pour ce match." });
    return;
  }

  res.json({
    matchId,
    winner: stats.winner,
    scoreArc: stats.scoreArc,
    scoreOpp: stats.scoreOpp,
    players: stats.players.map((p) => ({
      nickname: p.nickname,
      kills: p.kills,
      pentaKills: p.pentaKills,
      quadKills: p.quadKills,
      rws: p.rws,
      killThresholds: {
        "<15": p.kills < 15,
        ">15": p.kills > 15,
        ">30": p.kills > 30,
        ">50": p.kills > 50,
        ">60": p.kills > 60,
        ">70": p.kills > 70,
      },
      ace: p.pentaKills > 0,
      quadKill: p.quadKills > 0,
    })),
  });
});

