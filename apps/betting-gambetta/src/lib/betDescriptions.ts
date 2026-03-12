import type { BettingMatchPlayer } from "./api";

function findPlayerName(players: BettingMatchPlayer[], playerId?: string | null): string {
  if (!playerId) return "un joueur";
  const p = players.find((pl) => pl.id === playerId);
  return p ? p.steamDisplayName || p.name : "un joueur";
}

export function describeOutcomeFr(
  betType: string,
  payload: Record<string, unknown>,
  players: BettingMatchPlayer[],
): string {
  switch (betType) {
    case "VICTORY": {
      const outcome = payload?.outcome === "loss" ? "Défaite" : "Victoire";
      return `${outcome} d'ArcMonkey`;
    }
    case "KILLS": {
      const name = findPlayerName(players, payload?.playerId as string);
      const thr = String(payload?.threshold ?? "");
      let label = thr;
      if (thr === "<15") label = "moins de 15";
      else if (thr === ">15") label = "plus de 15";
      else if (thr === ">30") label = "plus de 30";
      else if (thr === ">50") label = "plus de 50";
      else if (thr === ">60") label = "plus de 60";
      else if (thr === ">70") label = "plus de 70";
      return `${name} fera ${label} kills`;
    }
    case "ACE": {
      const name = findPlayerName(players, payload?.playerId as string);
      return `${name} fera un ACE`;
    }
    case "QUAD_KILL": {
      const name = findPlayerName(players, payload?.playerId as string);
      return `${name} fera au moins un quadruple kill (4 kills dans un round)`;
    }
    case "MOST_KILLS": {
      const name = findPlayerName(players, payload?.playerId as string);
      return `${name} finira meilleur killer (le plus de kills)`;
    }
    case "EXACT_SCORE": {
      const arc = typeof payload?.scoreArcMonkey === "number" ? payload.scoreArcMonkey : Number(payload?.scoreArcMonkey);
      const opp = typeof payload?.scoreOpponent === "number" ? payload.scoreOpponent : Number(payload?.scoreOpponent);
      if (Number.isNaN(arc) || Number.isNaN(opp)) return "Score exact";
      return `Score exact : ArcMonkey ${arc} – ${opp}`;
    }
    default:
      return betType;
  }
}
