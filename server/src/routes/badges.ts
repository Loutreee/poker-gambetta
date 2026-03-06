import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../auth.js";
import { getMergedBadgeConfig } from "../badgeConfig.js";

const prisma = new PrismaClient();
export const badgesRouter = Router();

badgesRouter.get("/config", authMiddleware, async (_req, res) => {
  const config = await getMergedBadgeConfig(prisma);
  res.json(config);
});
