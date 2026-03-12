import { useCallback } from "react";
import { useWebHaptics } from "web-haptics/react";

export type HapticPattern = "success" | "nudge" | "error" | "buzz";

/**
 * Retourne une fonction qui déclenche un retour haptique puis exécute le handler.
 * Sur desktop/non support, seul le handler est exécuté.
 */
export function useHapticClick() {
  const { trigger } = useWebHaptics();

  return useCallback(
    (pattern: HapticPattern, handler: () => void) => () => {
      trigger(pattern);
      handler();
    },
    [trigger],
  );
}
