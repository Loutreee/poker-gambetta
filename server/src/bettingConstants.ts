/**
 * Constantes partagées pour le module betting (seuils, multiplicateurs, libellés).
 * Source unique de vérité pour le backend ; le front peut importer les libellés depuis l’API ou les dupliquer si besoin.
 */

export const BET_TYPES = [
  "VICTORY",
  "KILLS",
  "ACE",
  "QUAD_KILL",
  "MOST_KILLS",
  "EXACT_SCORE",
] as const;
export type BetType = (typeof BET_TYPES)[number];

/** Seuils de kills (totaux sur l’ensemble du BO) pour les paris KILLS. */
export const KILL_THRESHOLDS = ["<15", ">15", ">30", ">50", ">60", ">70"] as const;
export type KillThreshold = (typeof KILL_THRESHOLDS)[number];

/**
 * Multiplicateur de gain pour un pari KILLS selon le total de kills du joueur.
 */
export function getKillWinFactor(totalKills: number): number {
  if (totalKills < 15) return 2;
  if (totalKills < 30) return 1.1;
  if (totalKills < 50) return 1.3;
  if (totalKills < 60) return 1.5;
  if (totalKills < 70) return 2;
  return 3;
}

/** Facteurs de gain par type de pari (hors KILLS qui utilise getKillWinFactor). */
export const WIN_FACTORS: Record<BetType, number> = {
  VICTORY: 1.5,
  EXACT_SCORE: 1.75,
  KILLS: 1.3, // fallback si pas de killWinFactor fourni
  ACE: 3,
  QUAD_KILL: 1.5,
  MOST_KILLS: 3,
};

/** Limite de mise par pari par défaut (0 = pas de limite). */
export const DEFAULT_MAX_STAKE_PER_BET = 0;
/** Limite de mise totale par match par utilisateur par défaut (0 = pas de limite). */
export const DEFAULT_MAX_STAKE_PER_MATCH = 0;
