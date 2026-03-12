const FACEIT_API_KEY = process.env.FACEIT_API_KEY ?? "";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";

function logFaceitDebug(...args: unknown[]) {
  // Logs simples pour debug en dev, silencieux si pas de clé API.
  if (!FACEIT_API_KEY) return;
  // eslint-disable-next-line no-console
  console.log("[FACEIT]", ...args);
}

export type FaceitPlayerMatchStats = {
  nickname: string;
  kills: number;
  pentaKills: number;
  quadKills: number;
  rws: number;
};

export type FaceitMatchStats = {
  winner: "arc" | "opp" | "draw" | "unknown";
  scoreArc: number;
  scoreOpp: number;
  players: FaceitPlayerMatchStats[];
};

export function parseFaceitMatchUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("faceit.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // Exemples d'URL possibles :
    // /fr/cs2/room/<matchId>
    // /fr/cs2/room/<matchId>/scoreboard
    // /en/cs2/room/<matchId>
    // /cs2/room/<matchId>
    // → on cherche explicitement le segment "room" et on prend le suivant.
    const roomIdx = parts.findIndex((p) => p.toLowerCase() === "room");
    if (roomIdx !== -1 && parts[roomIdx + 1]) {
      const id = parts[roomIdx + 1];
      logFaceitDebug("parseFaceitMatchUrl room->id", { url, matchId: id });
      return id;
    }
    // Fallback ultra simple : on prend l'avant-dernier segment si le dernier est "scoreboard"
    const last = parts[parts.length - 1];
    const beforeLast = parts[parts.length - 2];
    if (last && last.toLowerCase() === "scoreboard" && beforeLast) {
      logFaceitDebug("parseFaceitMatchUrl scoreboard->beforeLast", { url, matchId: beforeLast });
      return beforeLast;
    }
    // Dernier fallback : dernier segment
    if (last) {
      logFaceitDebug("parseFaceitMatchUrl fallback last", { url, matchId: last });
      return last;
    }
    logFaceitDebug("parseFaceitMatchUrl failed", { url, parts });
    return null;
  } catch {
    return null;
  }
}

/** Réponse brute de l’API Faceit (structure variable selon l’endpoint). */
type FaceitApiResponse = Record<string, unknown> | null;

async function fetchFaceitApi(path: string): Promise<FaceitApiResponse> {
  if (!FACEIT_API_KEY) return null;
  const url = `${FACEIT_API_BASE}${path}`;
  logFaceitDebug("HTTP GET", url);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FACEIT_API_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    logFaceitDebug("HTTP error", { url, status: res.status, statusText: res.statusText });
    return null;
  }
  const json = (await res.json()) as Record<string, unknown>;
  logFaceitDebug("HTTP OK", { url, keys: Object.keys(json ?? {}) });
  return json;
}

export async function fetchFaceitMatchStats(matchId: string, arcTeamNameHint?: string, opponentNameHint?: string): Promise<FaceitMatchStats | null> {
  // 1) Détails du match (vainqueur + score global)
  const details = await fetchFaceitApi(`/matches/${encodeURIComponent(matchId)}`);
  if (!details) return null;
  logFaceitDebug("match details", {
    matchId,
    teamsKeys: Object.keys(details.teams ?? {}),
    results: details.results ?? null,
  });

  // D'après le swagger officiel [Data API](https://open.faceit.com/data/v4/docs/swagger.json) :
  // - details.teams est un objet : { "<factionKey>": { name, faction_id, ... }, ... }
  // - details.results : { winner: "<factionKey>", score: { "<factionKey>": <score>, ... } }
  const teamEntries = Object.entries(details.teams ?? {}) as Array<
    [string, { name?: string; faction_id?: string }]
  >;

  const results = (details.results ?? {}) as {
    winner?: string;
    score?: Record<string, number | string>;
  };

  if (!teamEntries.length || !results || !results.score) {
    return {
      winner: "unknown",
      scoreArc: 0,
      scoreOpp: 0,
      players: [],
    };
  }

  // On essaye de déterminer quelle faction est ArcMonkey et laquelle est l'adversaire.
  // On s'appuie sur les hints fournis par le modèle (opponentNameHint) : si le nom de l'équipe
  // Faceit contient le nom de l'adversaire, on considère l'autre comme ArcMonkey.
  let arcFactionId: string | undefined;
  let oppFactionId: string | undefined;

  if (opponentNameHint) {
    const lowerOpp = opponentNameHint.toLowerCase();
    const oppEntry = teamEntries.find(([, t]) =>
      (t.name ?? "").toLowerCase().includes(lowerOpp),
    );
    if (oppEntry) {
      const [oppKey] = oppEntry;
      oppFactionId = oppKey;
      const other = teamEntries.find(([key]) => key !== oppKey);
      arcFactionId = other?.[0];
    }
  }

  // Fallback simple : si on a un hint pour ArcMonkey, on essaye de le matcher aussi.
  if (!arcFactionId && arcTeamNameHint) {
    const lowerArc = arcTeamNameHint.toLowerCase();
    const arcEntry = teamEntries.find(([, t]) =>
      (t.name ?? "").toLowerCase().includes(lowerArc),
    );
    if (arcEntry) {
      const [arcKey] = arcEntry;
      arcFactionId = arcKey;
      const other = teamEntries.find(([key]) => key !== arcKey);
      oppFactionId = other?.[0];
    }
  }

  // Si on n'a toujours rien mais qu'on a exactement 2 équipes, on prend un mapping par défaut.
  if ((!arcFactionId || !oppFactionId) && teamEntries.length === 2) {
    arcFactionId = arcFactionId ?? teamEntries[0]?.[0];
    oppFactionId = oppFactionId ?? teamEntries[1]?.[0];
  }

  // Si on n'arrive pas à déterminer clairement les équipes, on renvoie unknown.
  if (!arcFactionId || !oppFactionId) {
    return {
      winner: "unknown",
      scoreArc: 0,
      scoreOpp: 0,
      players: [],
    };
  }

  const scoreArcRaw = results.score?.[arcFactionId];
  const scoreOppRaw = results.score?.[oppFactionId];

  const scoreArc = typeof scoreArcRaw === "number" ? scoreArcRaw : Number(scoreArcRaw ?? 0);
  const scoreOpp = typeof scoreOppRaw === "number" ? scoreOppRaw : Number(scoreOppRaw ?? 0);

  let winner: "arc" | "opp" | "draw" | "unknown" = "unknown";
  if (results.winner === arcFactionId) winner = "arc";
  else if (results.winner === oppFactionId) winner = "opp";
  else if (scoreArc === scoreOpp) winner = "draw";

  // 2) Stats détaillées par joueur pour ce match (kills, penta kills, etc.)
  const statsData = await fetchFaceitApi(`/matches/${encodeURIComponent(matchId)}/stats`);
  const players: FaceitPlayerMatchStats[] = [];

  if (statsData && Array.isArray(statsData.rounds) && statsData.rounds.length > 0) {
    type Agg = { kills: number; pentaKills: number; quadKills: number; rws: number };
    const aggByNickname = new Map<string, Agg>();
    type PlayerInRound = { nickname?: string; player_stats?: Record<string, unknown> };
    type RoundShape = { teams?: { players?: PlayerInRound[] }[] };
    const rounds = statsData.rounds as RoundShape[];

    for (const round of rounds) {
      const teamsStats = Array.isArray(round.teams) ? round.teams : [];
      for (const team of teamsStats) {
        const teamPlayers = Array.isArray(team.players) ? team.players : [];
        for (const pl of teamPlayers) {
          const nickname: string = String(pl.nickname ?? "");
          if (!nickname) continue;
          const statsObj = (pl.player_stats ?? {}) as Record<string, unknown>;
          const killsRaw = statsObj.Kills ?? statsObj.kills;
          const pentaRaw = statsObj["Penta Kills"] ?? statsObj["Penta kills"] ?? statsObj.pentaKills;
          const rwsRaw = statsObj.RWS ?? statsObj.rws ?? statsObj["RWS "] ?? statsObj["Rws"];
          const quadRaw =
            statsObj["Quadro Kills"] ??
            statsObj["Quadro kills"] ??
            statsObj.quadroKills ??
            statsObj.quadKills ??
            statsObj["Quad Kills"] ??
            statsObj["Quad kills"];
          const kills = typeof killsRaw === "number" ? killsRaw : Number(killsRaw ?? 0);
          const penta = typeof pentaRaw === "number" ? pentaRaw : Number(pentaRaw ?? 0);
          const quad = typeof quadRaw === "number" ? quadRaw : Number(quadRaw ?? 0);
          const rws = typeof rwsRaw === "number" ? rwsRaw : Number(rwsRaw ?? 0);

          const cur = aggByNickname.get(nickname) ?? { kills: 0, pentaKills: 0, quadKills: 0, rws: 0 };
          aggByNickname.set(nickname, {
            kills: cur.kills + (Number.isNaN(kills) ? 0 : kills),
            pentaKills: cur.pentaKills + (Number.isNaN(penta) ? 0 : penta),
            quadKills: cur.quadKills + (Number.isNaN(quad) ? 0 : quad),
            // Pour RWS, on garde la dernière valeur non nulle rencontrée (ou la somme si jamais utile)
            rws: Number.isNaN(rws) ? cur.rws : rws,
          });
        }
      }
    }

    for (const [nickname, agg] of aggByNickname.entries()) {
      players.push({
        nickname,
        kills: agg.kills,
        pentaKills: agg.pentaKills,
        quadKills: agg.quadKills,
        rws: agg.rws,
      });
    }

    logFaceitDebug("match stats aggregated", {
      matchId,
      rounds: statsData.rounds.length,
      playersCount: players.length,
    });
  } else {
    logFaceitDebug("no rounds stats", { matchId, hasStatsData: !!statsData });
  }

  return {
    winner,
    scoreArc: Number.isNaN(scoreArc) ? 0 : scoreArc,
    scoreOpp: Number.isNaN(scoreOpp) ? 0 : scoreOpp,
    players,
  };
}

