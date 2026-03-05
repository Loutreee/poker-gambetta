import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../auth.js";

const prisma = new PrismaClient();
export const adminRouter = Router();

// Auth + autorisation: réservé aux rôles admin et dealer
adminRouter.use(authMiddleware);
adminRouter.use((req, res, next) => {
  const user = (req as { user?: { role?: string } }).user;
  if (!user || (user.role !== "admin" && user.role !== "dealer")) {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }
  next();
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
  res.json({ users });
});

adminRouter.post("/users", async (req, res) => {
  const { name, role, password } = req.body as {
    name?: string;
    role?: string;
    password?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Nom invalide (au moins 2 caractères)." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    return;
  }
  const allowedRoles = ["player", "dealer", "admin"];
  const finalRole = allowedRoles.includes(role ?? "") ? (role as string) : "player";

  const existing = await prisma.user.findFirst({ where: { name: name.trim() } });
  if (existing) {
    res.status(400).json({ error: "Un utilisateur avec ce nom existe déjà." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      role: finalRole,
      passwordHash,
    },
    select: { id: true, name: true, role: true },
  });

  res.status(201).json({ user });
});

adminRouter.patch("/users/:userId", async (req, res) => {
  const userId = req.params.userId as string;
  const { name, role, password } = req.body as {
    name?: string;
    role?: string;
    password?: string;
  };

  const data: { name?: string; role?: string; passwordHash?: string } = {};

  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: "Nom invalide (au moins 2 caractères)." });
      return;
    }
    data.name = name.trim();
  }

  if (role !== undefined) {
    const allowedRoles = ["player", "dealer", "admin"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: "Rôle invalide." });
      return;
    }
    data.role = role;
  }

  if (password !== undefined) {
    if (!password || password.length < 6) {
      res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
      return;
    }
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, role: true },
  });

  res.json({ user });
});

