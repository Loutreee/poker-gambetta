import {
  BADGE_CATEGORY_IDS,
  SHARED_BADGE_CONFIG,
  getBadgeConfig as sharedGetBadgeConfig,
  type BadgeConfig,
  type BadgeDisplayOverride,
} from "@shared/badges";

/** Config badges avec surcharge locale (image special_euh_mec). */
export const BADGE_CONFIG: Record<string, BadgeConfig> = {
  ...SHARED_BADGE_CONFIG,
  special_euh_mec: {
    ...SHARED_BADGE_CONFIG.special_euh_mec,
    imageSrc: new URL("../assets/euh.jpg", import.meta.url).href,
  },
};

export type { BadgeConfig, BadgeDisplayOverride };
export { BADGE_CATEGORY_IDS };

export function getBadgeConfig(badgeId: string, override?: BadgeDisplayOverride | null): BadgeConfig | null {
  return sharedGetBadgeConfig(badgeId, override, BADGE_CONFIG);
}
