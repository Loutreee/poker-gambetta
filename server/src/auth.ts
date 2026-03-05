import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

export type JwtPayload = { userId: string };

export function signToken(userId: string): string {
  return jwt.sign({ userId } as JwtPayload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token =
    req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, role: true },
  });
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }
  (req as Request & { user: typeof user }).user = user;
  next();
}

export function requireRole(role: "dealer" | "admin") {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: { role: string } }).user;
    if (user.role !== role) {
      res.status(403).json({ error: "Accès réservé" });
      return;
    }
    next();
  };
}
