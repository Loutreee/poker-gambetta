import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { signToken } from "../auth.js";

const prisma = new PrismaClient();
export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { userId, password } = req.body as { userId?: string; password?: string };
  if (!userId || typeof password !== "string") {
    res.status(400).json({ error: "userId et password requis" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, passwordHash: true },
  });
  if (!user) {
    res.status(401).json({ error: "Compte introuvable ou mot de passe incorrect." });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Compte introuvable ou mot de passe incorrect." });
    return;
  }
  const token = signToken(user.id);
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    user: { id: user.id, name: user.name, role: user.role },
  });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(200).json({ user: null });
    return;
  }
  const { verifyToken } = await import("../auth.js");
  const payload = verifyToken(token);
  if (!payload) {
    res.status(200).json({ user: null });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, role: true },
  });
  res.json({ user: user ?? null });
});
