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

usersRouter.get("/leaderboard", authMiddleware, async (_req, res) => {
  const entries = await prisma.ledgerEntry.findMany({
    select: { userId: true, amount: true },
  });
  const balances: Record<string, number> = {};
  for (const e of entries) {
    balances[e.userId] = (balances[e.userId] ?? 0) + e.amount;
  }
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  const leaderboard = users
    .map((u: { id: string; name: string; role: string }) => ({ ...u, balance: balances[u.id] ?? 0 }))
    .sort((a: { balance: number }, b: { balance: number }) => b.balance - a.balance);
  res.json(leaderboard);
});
