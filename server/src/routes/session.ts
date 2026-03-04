import { Request, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, requireRole } from "../auth.js";

const prisma = new PrismaClient();
export const sessionRouter = Router();

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

async function recomputeSessionLedger(sessionId: string, dealerId: string): Promise<void> {
  if (!dealerId) throw new Error("dealerId manquant");
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { entries: true },
  });
  if (!session) return;

  const noteBase =
    session.name?.trim() ||
    `${session.type === "tournoi" ? "Tournoi" : "Sit and go"} du ${new Date(
      session.createdAt,
    ).toLocaleDateString("fr-FR")}`;

  await prisma.ledgerEntry.deleteMany({
    where: { sessionId },
  });

  for (const entry of session.entries) {
    const net = entry.result - entry.buyIn - entry.rebuy;
    if (net === 0 || !Number.isFinite(net)) continue;
    await prisma.ledgerEntry.create({
      data: {
        sessionId,
        userId: entry.userId,
        amount: net,
        note: noteBase,
        createdBy: dealerId,
      },
    });
  }
}

// Toutes les routes nécessitent un utilisateur connecté
sessionRouter.use(authMiddleware);

// Récupère la session ouverte la plus récente (s'il y en a une)
sessionRouter.get("/current", async (_req, res) => {
  const session = await prisma.session.findFirst({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      entries: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });
  res.json({ session });
});

// Liste l'historique des sessions (fermées)
sessionRouter.get("/", async (_req, res) => {
  const sessions = await prisma.session.findMany({
    where: { status: "closed" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      entries: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  res.json({ sessions });
});

// Met à jour les métadonnées d'une session (nom) — croupier uniquement
sessionRouter.patch("/:sessionId", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");
  const { name } = req.body as { name?: string };

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: "Session introuvable" });
    return;
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      name: name?.trim() || null,
    },
  });

  res.json({ session: updated });
});

// Supprime une session fermée de l'historique — croupier uniquement
sessionRouter.delete("/:sessionId", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== "closed") {
    res.status(400).json({ error: "Session introuvable ou encore ouverte" });
    return;
  }

  // Supprime aussi les écritures de ledger liées
  await prisma.ledgerEntry.deleteMany({ where: { sessionId } });
  await prisma.session.delete({ where: { id: sessionId } });
  res.status(204).send();
});

// Crée une nouvelle session (croupier uniquement)
sessionRouter.post("/", requireRole("dealer"), async (req, res) => {
  const { type, name, playerIds } = req.body as {
    type?: "sitngo" | "tournoi";
    name?: string;
    playerIds?: string[];
  };

  if (!type || !playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    res.status(400).json({ error: "type et au moins un joueur sont requis" });
    return;
  }

  const session = await prisma.session.create({
    data: {
      type,
      name: name?.trim() || null,
      status: "open",
      entries: {
        create: playerIds.map((userId) => ({
          userId,
        })),
      },
    },
    include: {
      entries: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  res.status(201).json({ session });
});

// Met à jour une entrée de session (buyIn, rebuy, result) — croupier uniquement
sessionRouter.patch("/:sessionId/entry/:entryId", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");
  const entryId = param(req, "entryId");
  const { buyIn, rebuy, result } = req.body as {
    buyIn?: number;
    rebuy?: number;
    result?: number;
  };

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(400).json({ error: "Session introuvable" });
    return;
  }

  const data: Record<string, number> = {};
  if (typeof buyIn === "number" && Number.isFinite(buyIn)) data.buyIn = Math.trunc(buyIn);
  if (typeof rebuy === "number" && Number.isFinite(rebuy)) data.rebuy = Math.trunc(rebuy);
  if (typeof result === "number" && Number.isFinite(result)) data.result = Math.trunc(result);

  const entry = await prisma.sessionEntry.update({
    where: { id: entryId },
    data,
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  if (session.status === "closed") {
    const dealer = (req as any).user as { id: string };
    await recomputeSessionLedger(sessionId, dealer.id);
  }

  res.json({ entry });
});

// Ajoute un joueur à une session (sit & go uniquement) — croupier uniquement
sessionRouter.post("/:sessionId/entry", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { entries: true },
  });
  if (!session || session.type !== "sitngo") {
    res.status(400).json({ error: "Session introuvable ou non compatible" });
    return;
  }

  if (session.entries.some((e) => e.userId === userId)) {
    res.status(400).json({ error: "Ce joueur est déjà dans la session" });
    return;
  }

  const entry = await prisma.sessionEntry.create({
    data: {
      sessionId,
      userId,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  const dealer = (req as any).user as { id: string };
  if (session.status === "closed") {
    await recomputeSessionLedger(sessionId, dealer.id);
  }

  res.status(201).json({ entry });
});

// Annule une session (supprime sans écrire dans le ledger) — croupier uniquement
sessionRouter.post("/:sessionId/cancel", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== "open") {
    res.status(400).json({ error: "Session introuvable ou déjà clôturée" });
    return;
  }

  await prisma.session.delete({ where: { id: sessionId } });
  res.json({ ok: true });
});

// Supprime une entrée (joueur) d'une session — croupier uniquement
sessionRouter.delete("/:sessionId/entry/:entryId", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");
  const entryId = param(req, "entryId");

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(400).json({ error: "Session introuvable" });
    return;
  }

  await prisma.sessionEntry.delete({ where: { id: entryId } });

  if (session.status === "closed") {
    const dealer = (req as any).user as { id: string };
    await recomputeSessionLedger(sessionId, dealer.id);
  }

  res.status(204).send();
});

// Clôture la session, crée les entrées ledger et renvoie un classement de la session — croupier uniquement
sessionRouter.post("/:sessionId/close", requireRole("dealer"), async (req, res) => {
  const sessionId = param(req, "sessionId");
  const dealer = (req as { user?: { id: string; name: string } }).user;

  try {
    if (!dealer?.id) {
      res.status(500).json({ error: "Utilisateur croupier introuvable" });
      return;
    }
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        entries: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    if (!session || session.status !== "open") {
      res.status(400).json({ error: "Session introuvable ou déjà clôturée" });
      return;
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { status: "closed", closedAt: new Date() },
      include: {
        entries: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });

    const ranking = [...updatedSession.entries]
      .map((e) => {
        const net = e.result - e.buyIn - e.rebuy;
        return {
          userId: e.userId,
          name: e.user.name,
          result: net,
        };
      })
      .sort((a, b) => b.result - a.result);

    await recomputeSessionLedger(sessionId, dealer.id);

    res.json({ session: updatedSession, ranking });
  } catch (err) {
    console.error("[session close]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur lors de la clôture de la session",
    });
  }
});

