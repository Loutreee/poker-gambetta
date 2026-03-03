import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../auth.js";

const prisma = new PrismaClient();
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
    select: { id: true, name: true, role: true },
  });

  const withBalance = users.map((u: { id: string; name: string; role: string }) => ({
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

  const leaderboard = sortedNow.map((u, idx) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    balance: u.balance,
    balanceDeltaWeek: u.balance - u.balanceWeekAgo,
    rankChange: rankWeekAgoByUserId[u.id] != null ? idx + 1 - rankWeekAgoByUserId[u.id]! : 0,
  }));

  res.json(leaderboard);
});
