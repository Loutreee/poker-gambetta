import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, requireRole } from "../auth.js";

const prisma = new PrismaClient();
export const ledgerRouter = Router();

ledgerRouter.use(authMiddleware);

ledgerRouter.get("/", async (req, res) => {
  const forUser = req.query.userId as string | undefined;
  if (forUser) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { userId: forUser },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json(entries);
  }
  const entries = await prisma.ledgerEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json(entries);
});

ledgerRouter.get("/me", async (req, res) => {
  const userId = req.user!.id;
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(entries);
});

ledgerRouter.post("/", requireRole("dealer"), async (req, res) => {
  const author = req.user!;
  const { userId, amount, note } = req.body as {
    userId?: string;
    amount?: number;
    note?: string;
  };
  if (!userId || typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
    res.status(400).json({ error: "userId et amount (nombre non nul) requis" });
    return;
  }
  const entry = await prisma.ledgerEntry.create({
    data: {
      userId,
      amount,
      note: (note && String(note).trim()) || "Ajustement",
      createdBy: author.id,
    },
  });
  res.status(201).json(entry);
});

ledgerRouter.patch("/:id", requireRole("dealer"), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "id manquant" });
    return;
  }
  const { amount, note } = req.body as { amount?: number; note?: string };
  const entry = await prisma.ledgerEntry.findUnique({ where: { id } });
  if (!entry) {
    res.status(404).json({ error: "Entrée introuvable" });
    return;
  }
  const updated = await prisma.ledgerEntry.update({
    where: { id },
    data: {
      ...(typeof amount === "number" && Number.isFinite(amount) ? { amount } : {}),
      ...(note !== undefined ? { note: String(note).trim() || "Ajustement" } : {}),
    },
  });
  res.json(updated);
});

ledgerRouter.delete("/:id", requireRole("dealer"), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];
  if (!id) {
    res.status(400).json({ error: "id manquant" });
    return;
  }
  await prisma.ledgerEntry.deleteMany({ where: { id } });
  res.status(204).send();
});
