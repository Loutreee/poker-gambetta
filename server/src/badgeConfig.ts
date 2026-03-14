import type { PrismaClient } from "@prisma/client";
import { BADGE_IDS } from "./badges.js";

export type BadgeDisplay = { name: string; description: string; bgColor: string; iconColor: string };

const DEFAULTS: Record<string, BadgeDisplay> = {
  [BADGE_IDS.PARTICIPATION_1]: { name: "Première main", description: "A joué sa première soirée", bgColor: "#b87333", iconColor: "#fef3c7" },
  [BADGE_IDS.PARTICIPATION_5]: { name: "Habitué", description: "5 soirées jouées", bgColor: "#94a3b8", iconColor: "#1e293b" },
  [BADGE_IDS.PARTICIPATION_10]: { name: "Régulier", description: "10 soirées jouées", bgColor: "#eab308", iconColor: "#422006" },
  [BADGE_IDS.PARTICIPATION_25]: { name: "Connoisseur", description: "25 soirées jouées", bgColor: "#e2e8f0", iconColor: "#475569" },
  [BADGE_IDS.PARTICIPATION_50]: { name: "Pilier du Gambetta", description: "50 soirées jouées", bgColor: "#38bdf8", iconColor: "#0c4a6e" },
  [BADGE_IDS.VICTORIES_1]: { name: "Première victoire", description: "Gagner sa première soirée", bgColor: "#b87333", iconColor: "#fef3c7" },
  [BADGE_IDS.VICTORIES_2]: { name: "Double champion", description: "2 victoires", bgColor: "#94a3b8", iconColor: "#1e293b" },
  [BADGE_IDS.VICTORIES_3]: { name: "Triplé", description: "3 victoires", bgColor: "#eab308", iconColor: "#422006" },
  [BADGE_IDS.VICTORIES_5]: { name: "Patron", description: "5 victoires", bgColor: "#e2e8f0", iconColor: "#475569" },
  [BADGE_IDS.VICTORIES_10]: { name: "Dynastie", description: "10 victoires", bgColor: "#38bdf8", iconColor: "#0c4a6e" },
  [BADGE_IDS.GAINS_FIRST]: { name: "Premier billet", description: "Premier gain positif", bgColor: "#b87333", iconColor: "#fef3c7" },
  [BADGE_IDS.GAINS_5K]: { name: "Gros coup", description: "Gain > 5000$ sur une soirée", bgColor: "#94a3b8", iconColor: "#1e293b" },
  [BADGE_IDS.GAINS_10K]: { name: "Braquage", description: "Gain > 10000$ sur une soirée", bgColor: "#eab308", iconColor: "#422006" },
  [BADGE_IDS.GAINS_15K]: { name: "Machine à cash", description: "Gains > 15000$", bgColor: "#e2e8f0", iconColor: "#475569" },
  [BADGE_IDS.GAINS_20K]: { name: "Tu joues avec la peur ?", description: "Gains > 20000$", bgColor: "#38bdf8", iconColor: "#0c4a6e" },
  [BADGE_IDS.CLASSEMENT_PODIUM]: { name: "Podium", description: "Finir dans le top 3 d'une soirée", bgColor: "#b87333", iconColor: "#fef3c7" },
  [BADGE_IDS.CLASSEMENT_RUNNER_UP]: { name: "Runner-up", description: "Finir 2ème", bgColor: "#94a3b8", iconColor: "#1e293b" },
  [BADGE_IDS.CLASSEMENT_CHAMPION]: { name: "Champion", description: "Finir 1er", bgColor: "#eab308", iconColor: "#422006" },
  [BADGE_IDS.CLASSEMENT_TOP_REGULIER]: { name: "Top régulier", description: "5 podiums", bgColor: "#38bdf8", iconColor: "#0c4a6e" },
  [BADGE_IDS.BANKROLL_40K]: { name: "Bon gestionnaire", description: "Bankroll > 40000€", bgColor: "#0d9488", iconColor: "#ccfbf1" },
  [BADGE_IDS.BANKROLL_WHALE]: { name: "Whale", description: "Plus grosse bankroll du site", bgColor: "#6366f1", iconColor: "#e0e7ff" },
  [BADGE_IDS.RECORD_BEST_SESSION]: { name: "Ma question préférée", description: "Détenir le record de gain sur une soirée", bgColor: "#a855f7", iconColor: "#f5f3ff" },
  [BADGE_IDS.RECORD_SERIE_NOIRE]: { name: "Série noire", description: "3 soirées sans gain", bgColor: "#475569", iconColor: "#cbd5e1" },
  [BADGE_IDS.SPECIAL_EUH_MEC]: { name: "Euuh mec ?", description: "Parier sur la défaite de ArcMonkey ... et gagner", bgColor: "#7c3aed", iconColor: "#ede9fe" },
  [BADGE_IDS.BETS_FIRST]: { name: "Premier pari", description: "A fait son premier pari", bgColor: "#0f766e", iconColor: "#ecfeff" },
  [BADGE_IDS.BETS_FIRST_WIN]: { name: "Premier ticket gagnant", description: "A gagné son premier pari", bgColor: "#22c55e", iconColor: "#ecfdf3" },
  [BADGE_IDS.BETS_10]: { name: "Parieur occasionnel", description: "10 paris effectués", bgColor: "#0284c7", iconColor: "#e0f2fe" },
  [BADGE_IDS.BETS_50]: { name: "Parieur sérieux", description: "50 paris effectués", bgColor: "#0369a1", iconColor: "#e0f2fe" },
  [BADGE_IDS.BETS_100]: { name: "Parieur compulsif", description: "100 paris effectués", bgColor: "#0f172a", iconColor: "#f9fafb" },
  [BADGE_IDS.BETS_LOSING_STREAK]: { name: "No run good", description: "Perdre 5 paris d'affilée", bgColor: "#1e293b", iconColor: "#e5e7eb" },
  [BADGE_IDS.SPECIAL_LAST_SECOND_BET]: { name: "Dernière seconde", description: "Gagner un pari placé dans la dernière minute", bgColor: "#eab308", iconColor: "#fefce8" },
  [BADGE_IDS.SPECIAL_ALL_IN_BET]: { name: "All-in IRL", description: "Mettre plus de 50% de sa bankroll sur un pari gagnant", bgColor: "#b91c1c", iconColor: "#fee2e2" },
  [BADGE_IDS.SPECIAL_CONTRA_PUBLIC]: { name: "À contre-courant", description: "Gagner un pari où tu es dans la minorité des parieurs", bgColor: "#4b5563", iconColor: "#e5e7eb" },
  [BADGE_IDS.SPECIAL_TES_CON]: { name: "T'es con ?", description: "Parier l'intégralité de son bankroll", bgColor: "#dc2626", iconColor: "#fef2f2" },
};

const ALL_BADGE_IDS = Object.keys(DEFAULTS);

export function getAllBadgeIds(): string[] {
  return [...ALL_BADGE_IDS];
}

export async function getMergedBadgeConfig(prisma: PrismaClient): Promise<Record<string, BadgeDisplay>> {
  const overrides = await prisma.badgeOverride.findMany();
  const overrideMap = new Map(overrides.map((o) => [o.badgeId, o]));
  const result: Record<string, BadgeDisplay> = {};
  for (const id of ALL_BADGE_IDS) {
    const def = DEFAULTS[id];
    const ov = overrideMap.get(id);
    result[id] = {
      name: ov?.name ?? def.name,
      description: ov?.description ?? def.description,
      bgColor: ov?.bgColor ?? def.bgColor,
      iconColor: ov?.iconColor ?? def.iconColor,
    };
  }
  return result;
}
