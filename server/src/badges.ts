import type { PrismaClient } from "@prisma/client";

export type UserBadge = { badgeId: string; count: number };

/** IDs des badges (alignés avec le front). */
export const BADGE_IDS = {
  PARTICIPATION_1: "participation_1",
  PARTICIPATION_5: "participation_5",
  PARTICIPATION_10: "participation_10",
  PARTICIPATION_25: "participation_25",
  PARTICIPATION_50: "participation_50",
  VICTORIES_1: "victories_1",
  VICTORIES_2: "victories_2",
  VICTORIES_3: "victories_3",
  VICTORIES_5: "victories_5",
  VICTORIES_10: "victories_10",
  GAINS_FIRST: "gains_first",
  GAINS_5K: "gains_5k",
  GAINS_10K: "gains_10k",
  GAINS_15K: "gains_15k",
  GAINS_20K: "gains_20k",
  CLASSEMENT_PODIUM: "classement_podium",
  CLASSEMENT_RUNNER_UP: "classement_runner_up",
  CLASSEMENT_CHAMPION: "classement_champion",
  CLASSEMENT_TOP_REGULIER: "classement_top_regulier",
  BANKROLL_40K: "bankroll_40k",
  BANKROLL_WHALE: "bankroll_whale",
  RECORD_BEST_SESSION: "record_best_session",
  RECORD_SERIE_NOIRE: "record_serie_noire",
} as const;


export async function computeUserBadges(prisma: PrismaClient, userId: string): Promise<UserBadge[]> {
  const result: UserBadge[] = [];

  const [closedSessions, myEntries, allEntriesBySession, ledgerSum, allBalances] = await Promise.all([
    prisma.session.findMany({
      where: { status: "closed", closedAt: { not: null } },
      orderBy: { closedAt: "asc" },
      select: { id: true, closedAt: true },
    }),
    prisma.sessionEntry.findMany({
      where: { userId },
      select: { sessionId: true, buyIn: true, rebuy: true, result: true },
    }),
    prisma.sessionEntry.findMany({
      where: { session: { status: "closed", closedAt: { not: null } } },
      select: { sessionId: true, userId: true, buyIn: true, rebuy: true, result: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { userId },
      _sum: { amount: true },
    }).then((r) => r._sum.amount ?? 0),
    prisma.ledgerEntry.groupBy({
      by: ["userId"],
      _sum: { amount: true },
    }).then((groups) => new Map(groups.map((g) => [g.userId, g._sum.amount ?? 0]))),
  ]);

  const mySessionIds = new Set(myEntries.map((e) => e.sessionId));
  const closedSessionIds = new Set(closedSessions.map((s) => s.id));
  const sessionsPlayed = closedSessions.filter((s) => mySessionIds.has(s.id)).length;

  const netPerEntry = (e: { buyIn: number; rebuy: number; result: number }) =>
    Number(e.result) - Number(e.buyIn) - Number(e.rebuy);

  type EntryWithUser = { sessionId: string; userId: string; buyIn: number; rebuy: number; result: number };
  const entriesBySession = new Map<string, EntryWithUser[]>();
  for (const e of allEntriesBySession) {
    if (!entriesBySession.has(e.sessionId)) entriesBySession.set(e.sessionId, []);
    entriesBySession.get(e.sessionId)!.push(e);
  }

  let wins = 0;
  let secondPlace = 0;
  let podiums = 0;
  let bestSessionNet = 0;
  let totalGains = 0;
  const sessionNets: number[] = [];

  for (const entry of myEntries) {
    if (!closedSessionIds.has(entry.sessionId)) continue;
    const sessionEntries = entriesBySession.get(entry.sessionId) ?? [];
    const nets = sessionEntries.map((e) => ({
      userId: e.userId,
      net: netPerEntry(e),
    }));
    nets.sort((a, b) => b.net - a.net);
    const myNet = netPerEntry(entry);
    sessionNets.push(myNet);
    if (myNet > 0) totalGains += myNet;
    if (myNet > bestSessionNet) bestSessionNet = myNet;

    const rank = nets.findIndex((n) => n.userId === userId) + 1;
    if (rank === 1) wins++;
    if (rank === 2) secondPlace++;
    if (rank >= 1 && rank <= 3) podiums++;
  }

  // Participation : un seul badge, le niveau le plus élevé atteint (count toujours 1)
  if (sessionsPlayed >= 50) result.push({ badgeId: BADGE_IDS.PARTICIPATION_50, count: 1 });
  else if (sessionsPlayed >= 25) result.push({ badgeId: BADGE_IDS.PARTICIPATION_25, count: 1 });
  else if (sessionsPlayed >= 10) result.push({ badgeId: BADGE_IDS.PARTICIPATION_10, count: 1 });
  else if (sessionsPlayed >= 5) result.push({ badgeId: BADGE_IDS.PARTICIPATION_5, count: 1 });
  else if (sessionsPlayed >= 1) result.push({ badgeId: BADGE_IDS.PARTICIPATION_1, count: 1 });

  // Victoires : un seul badge par palier, pas cumulable (count toujours 1)
  if (wins >= 10) result.push({ badgeId: BADGE_IDS.VICTORIES_10, count: 1 });
  else if (wins >= 5) result.push({ badgeId: BADGE_IDS.VICTORIES_5, count: 1 });
  else if (wins >= 3) result.push({ badgeId: BADGE_IDS.VICTORIES_3, count: 1 });
  else if (wins >= 2) result.push({ badgeId: BADGE_IDS.VICTORIES_2, count: 1 });
  else if (wins >= 1) result.push({ badgeId: BADGE_IDS.VICTORIES_1, count: 1 });

  // Gains : un seul badge, le niveau le plus élevé atteint (ordre : 20k total > 15k total > 10k session > 5k session > premier positif)
  const hasPositiveGain = sessionNets.some((n) => n > 0);
  if (totalGains >= 20000) result.push({ badgeId: BADGE_IDS.GAINS_20K, count: 1 });
  else if (totalGains >= 15000) result.push({ badgeId: BADGE_IDS.GAINS_15K, count: 1 });
  else if (bestSessionNet >= 10000) result.push({ badgeId: BADGE_IDS.GAINS_10K, count: 1 });
  else if (bestSessionNet >= 5000) result.push({ badgeId: BADGE_IDS.GAINS_5K, count: 1 });
  else if (hasPositiveGain) result.push({ badgeId: BADGE_IDS.GAINS_FIRST, count: 1 });

  // Classement (cumulables)
  if (podiums > 0) result.push({ badgeId: BADGE_IDS.CLASSEMENT_PODIUM, count: podiums });
  if (secondPlace > 0) result.push({ badgeId: BADGE_IDS.CLASSEMENT_RUNNER_UP, count: secondPlace });
  if (wins > 0) result.push({ badgeId: BADGE_IDS.CLASSEMENT_CHAMPION, count: wins });
  if (podiums >= 5) result.push({ badgeId: BADGE_IDS.CLASSEMENT_TOP_REGULIER, count: 1 });

  const balance = Number(ledgerSum);
  if (balance >= 40000) result.push({ badgeId: BADGE_IDS.BANKROLL_40K, count: 1 });
  const allBalanceValues = [...allBalances.values()];
  if (!allBalances.has(userId)) allBalanceValues.push(balance);
  const maxBalance = Math.max(0, ...allBalanceValues);
  if (balance >= maxBalance && maxBalance > 0) {
    result.push({ badgeId: BADGE_IDS.BANKROLL_WHALE, count: 1 });
  }

  // Record meilleure soirée : meilleur net sur une session parmi tous les joueurs
  let globalBestSessionNet = 0;
  for (const [, entries] of entriesBySession) {
    for (const e of entries) {
      const net = netPerEntry(e);
      if (net > globalBestSessionNet) globalBestSessionNet = net;
    }
  }
  if (bestSessionNet >= globalBestSessionNet && globalBestSessionNet > 0) {
    result.push({ badgeId: BADGE_IDS.RECORD_BEST_SESSION, count: 1 });
  }

  // Série noire : 3 soirées d'affilée sans gain (net <= 0)
  const sortedSessionNets = closedSessions
    .filter((s) => mySessionIds.has(s.id))
    .map((s) => {
      const entry = myEntries.find((e) => e.sessionId === s.id);
      return entry ? netPerEntry(entry) : 0;
    });
  let streak = 0;
  for (const net of sortedSessionNets) {
    if (net <= 0) {
      streak++;
      if (streak >= 3) {
        result.push({ badgeId: BADGE_IDS.RECORD_SERIE_NOIRE, count: 1 });
        break;
      }
    } else streak = 0;
  }

  return result;
}
