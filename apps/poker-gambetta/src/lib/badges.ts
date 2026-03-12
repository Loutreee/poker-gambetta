import type { LucideIcon } from "lucide-react";
import {
  Target,
  Calendar,
  Sparkles,
  Award,
  Building2,
  Trophy,
  Medal,
  Crown,
  Star,
  DollarSign,
  Banknote,
  TrendingUp,
  Gem,
  Flame,
  BarChart3,
  Wallet,
  CircleDollarSign,
  Moon,
} from "lucide-react";

const TIER_BRONZE = { bgColor: "#b87333", iconColor: "#fef3c7" };
const TIER_SILVER = { bgColor: "#94a3b8", iconColor: "#1e293b" };
const TIER_GOLD = { bgColor: "#eab308", iconColor: "#422006" };
const TIER_PLATINUM = { bgColor: "#e2e8f0", iconColor: "#475569" };
const TIER_DIAMOND = { bgColor: "#38bdf8", iconColor: "#0c4a6e" };

export type BadgeConfig = {
  name: string;
  description: string;
  bgColor: string;
  iconColor: string;
  Icon: LucideIcon;
  /** Si défini, l’image remplit le cercle du badge (badge spécial). */
  imageSrc?: string;
};

export const BADGE_CONFIG: Record<string, BadgeConfig> = {
  participation_1: { name: "Première main", description: "A joué sa première soirée", Icon: Target, ...TIER_BRONZE },
  participation_5: { name: "Habitué", description: "5 soirées jouées", Icon: Calendar, ...TIER_SILVER },
  participation_10: { name: "Régulier", description: "10 soirées jouées", Icon: Sparkles, ...TIER_GOLD },
  participation_25: { name: "Connoisseur", description: "25 soirées jouées", Icon: Award, ...TIER_PLATINUM },
  participation_50: { name: "Pilier du Gambetta", description: "50 soirées jouées", Icon: Building2, ...TIER_DIAMOND },
  victories_1: { name: "Première victoire", description: "Gagner sa première soirée", Icon: Trophy, ...TIER_BRONZE },
  victories_2: { name: "Double champion", description: "2 victoires", Icon: Medal, ...TIER_SILVER },
  victories_3: { name: "Triplé", description: "3 victoires", Icon: Medal, ...TIER_GOLD },
  victories_5: { name: "Patron", description: "5 victoires", Icon: Crown, ...TIER_PLATINUM },
  victories_10: { name: "Dynastie", description: "10 victoires", Icon: Star, ...TIER_DIAMOND },
  gains_first: { name: "Premier billet", description: "Premier gain positif", Icon: DollarSign, ...TIER_BRONZE },
  gains_5k: { name: "Gros coup", description: "Gain > 5000$ sur une soirée", Icon: Banknote, ...TIER_SILVER },
  gains_10k: { name: "Braquage", description: "Gain > 10000$ sur une soirée", Icon: TrendingUp, ...TIER_GOLD },
  gains_15k: { name: "Machine à cash", description: "Gains > 15000$", Icon: Gem, ...TIER_PLATINUM },
  gains_20k: { name: "Tu joues avec la peur ?", description: "Gains > 20000$", Icon: Flame, ...TIER_DIAMOND },
  classement_podium: { name: "Podium", description: "Finir dans le top 3 d'une soirée", Icon: BarChart3, ...TIER_BRONZE },
  classement_runner_up: { name: "Runner-up", description: "Finir 2ème", Icon: Medal, ...TIER_SILVER },
  classement_champion: { name: "Champion", description: "Finir 1er", Icon: Trophy, ...TIER_GOLD },
  classement_top_regulier: { name: "Top régulier", description: "5 podiums", Icon: Star, ...TIER_DIAMOND },
  bankroll_40k: { name: "Bon gestionnaire", description: "Bankroll > 40000€", Icon: Wallet, bgColor: "#0d9488", iconColor: "#ccfbf1" },
  bankroll_whale: { name: "Whale", description: "Plus grosse bankroll du site", Icon: CircleDollarSign, bgColor: "#6366f1", iconColor: "#e0e7ff" },
  record_best_session: { name: "Ma question préférée", description: "Détenir le record de gain sur une soirée", Icon: Gem, bgColor: "#a855f7", iconColor: "#f5f3ff" },
  record_serie_noire: { name: "Série noire", description: "3 soirées sans gain", Icon: Moon, bgColor: "#475569", iconColor: "#cbd5e1" },
  special_euh_mec: {
    name: "Euuh mec ?",
    description: "Parier sur la défaite de ArcMonkey ... et gagner",
    Icon: Award,
    bgColor: "#7c3aed",
    iconColor: "#ede9fe",
    imageSrc: new URL("../assets/euh.jpg", import.meta.url).href,
  },
};

export type BadgeDisplayOverride = { name: string; description: string; bgColor: string; iconColor: string };

/** Catégories et liste de badgeIds pour la page admin. */
export const BADGE_CATEGORY_IDS: { id: string; title: string; note?: string; color: string; badgeIds: string[] }[] = [
  { id: "participation", title: "Participation", color: "#64748b", badgeIds: ["participation_1", "participation_5", "participation_10", "participation_25", "participation_50"] },
  { id: "victoires", title: "Victoires", color: "#b45309", badgeIds: ["victories_1", "victories_2", "victories_3", "victories_5", "victories_10"] },
  { id: "gains", title: "Gains", color: "#15803d", badgeIds: ["gains_first", "gains_5k", "gains_10k", "gains_15k", "gains_20k"] },
  { id: "classement", title: "Classement", note: "Badge cumulable, gagnable à chaque session", color: "#7c3aed", badgeIds: ["classement_podium", "classement_runner_up", "classement_champion", "classement_top_regulier"] },
  { id: "bankroll", title: "Bankroll", note: "Perdable", color: "#0e7490", badgeIds: ["bankroll_40k", "bankroll_whale"] },
  { id: "records", title: "Records", note: "Perdable", color: "#be123c", badgeIds: ["record_best_session", "record_serie_noire"] },
  { id: "special", title: "Spécial", color: "#7c3aed", badgeIds: ["special_euh_mec"] },
];

export function getBadgeConfig(badgeId: string, override?: BadgeDisplayOverride | null): BadgeConfig | null {
  const base = BADGE_CONFIG[badgeId] ?? null;
  if (!base) return null;
  if (!override) return base;
  return {
    ...base,
    name: override.name,
    description: override.description,
    bgColor: override.bgColor,
    iconColor: override.iconColor,
  };
}
