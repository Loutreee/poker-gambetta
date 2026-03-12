const API_BASE = "/api";

async function fetchApi<T>(
  path: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...init } = options ?? {};
  const headers: HeadersInit = { ...(init.headers as Record<string, string>) };
  if (json !== undefined) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Erreur API");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type User = { id: string; name: string; role: string };
export type UserProfile = User & { avatarUrl: string | null; bio: string | null };
export type UserBadge = { badgeId: string; count: number };
export type BalanceHistoryPoint = { date: string; balance: number; sessionId: string; sessionName: string | null };
export type LedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type SessionEntry = {
  id: string;
  sessionId: string;
  userId: string;
  buyIn: number;
  rebuy: number;
  result: number;
  createdAt: string;
  user: User;
};

export type Session = {
  id: string;
  type: "sitngo" | "tournoi";
  name: string | null;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  entries: SessionEntry[];
};

export type ArcMonkeyPlayer = {
  id: string;
  name: string;
  steamProfileUrl: string | null;
  steamDisplayName: string | null;
  steamAvatarUrl?: string | null;
  userId: string | null;
  active: boolean;
  user: { id: string; name: string; avatarUrl: string | null } | null;
  avatarUrl?: string | null;
};

export type BettingMatchPlayer = {
  id: string;
  name: string;
  steamDisplayName: string;
  steamProfileUrl: string | null;
  avatarUrl: string | null;
  userName: string | null;
};

export type BettingMatch = {
  id: string;
  title?: string | null;
  opponent: string;
  format?: string; // "BO1" | "BO3" | "BO5"
  scheduledAt: string;
  status: string;
  faceitMatchUrl?: string | null;
  isLive?: boolean;
  maxStakePerBet?: number | null;
  maxStakePerMatch?: number | null;
  players: BettingMatchPlayer[];
};

export type Bet = {
  id: string;
  matchId: string;
  userId: string;
  amount: number;
  betType: "VICTORY" | "KILLS" | "ACE" | "EXACT_SCORE" | "QUAD_KILL" | "MOST_KILLS";
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
  user?: { id: string; name: string };
};

export const api = {
  getMe(): Promise<{ user: User | null }> {
    return fetchApi("/auth/me");
  },

  login(userId: string, password: string): Promise<{ user: User }> {
    return fetchApi("/auth/login", { method: "POST", json: { userId, password } });
  },

  logout(): Promise<{ ok: boolean }> {
    return fetchApi("/auth/logout", { method: "POST" });
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    return fetchApi("/auth/change-password", {
      method: "POST",
      json: { currentPassword, newPassword },
    });
  },

  getUsers(): Promise<User[]> {
    return fetchApi("/users");
  },

  getProfile(userId: string): Promise<{
    user: UserProfile;
    balance: number;
    pendingStakes?: number;
    badges: UserBadge[];
  }> {
    return fetchApi(`/users/${userId}/profile`);
  },

  updateMyProfile(data: { name?: string; avatarUrl?: string | null; bio?: string | null }): Promise<{ user: UserProfile }> {
    return fetchApi("/users/me/profile", { method: "PATCH", json: data });
  },

  /** Envoie une photo de profil (data URL base64, ex. depuis un input file). */
  uploadAvatar(imageDataUrl: string): Promise<{ user: UserProfile; avatarUrl: string }> {
    return fetchApi("/users/me/avatar", { method: "POST", json: { image: imageDataUrl } });
  },

  getBalanceHistory(userId: string): Promise<{ points: BalanceHistoryPoint[] }> {
    return fetchApi(`/users/balance-history/${userId}`);
  },

  getBadgesConfig(): Promise<Record<string, { name: string; description: string; bgColor: string; iconColor: string }>> {
    return fetchApi("/badges/config");
  },

  updateBadge(
    badgeId: string,
    data: { name?: string; description?: string; bgColor?: string; iconColor?: string },
  ): Promise<{ badgeId: string; name: string | null; description: string | null; bgColor: string | null; iconColor: string | null }> {
    return fetchApi(`/admin/badges/${encodeURIComponent(badgeId)}`, { method: "PATCH", json: data });
  },

  // Admin
  getAdminUsers(): Promise<{ users: User[] }> {
    return fetchApi("/admin/users");
  },

  createUser(params: { name: string; role: string; password: string }): Promise<{ user: User }> {
    return fetchApi("/admin/users", { method: "POST", json: params });
  },

  updateUser(
    userId: string,
    data: { name?: string; role?: string; password?: string },
  ): Promise<{ user: User }> {
    return fetchApi(`/admin/users/${userId}`, { method: "PATCH", json: data });
  },

  getLeaderboard(): Promise<(User & { avatarUrl: string | null; balance: number; balanceDeltaWeek: number; rankChange: number; badges: UserBadge[] })[]> {
    return fetchApi("/users/leaderboard");
  },

  getLedger(params?: { userId?: string }): Promise<LedgerEntry[]> {
    const q = params?.userId ? `?userId=${encodeURIComponent(params.userId)}` : "";
    return fetchApi(`/ledger${q}`);
  },

  getMyEntries(): Promise<LedgerEntry[]> {
    return fetchApi("/ledger/me");
  },

  createEntry(userId: string, amount: number, note: string): Promise<LedgerEntry> {
    return fetchApi("/ledger", {
      method: "POST",
      json: { userId, amount, note: note.trim() || "Ajustement" },
    });
  },

  updateEntry(id: string, data: { amount?: number; note?: string }): Promise<LedgerEntry> {
    return fetchApi(`/ledger/${id}`, { method: "PATCH", json: data });
  },

  deleteEntry(id: string): Promise<void> {
    return fetchApi(`/ledger/${id}`, { method: "DELETE" });
  },

  // Sessions (croupier)
  getCurrentSession(): Promise<{ session: Session | null }> {
    return fetchApi("/session/current");
  },

  getSessions(): Promise<{ sessions: Session[] }> {
    return fetchApi("/session");
  },

  createSession(params: {
    type: "sitngo" | "tournoi";
    name?: string;
    playerIds: string[];
  }): Promise<{ session: Session }> {
    return fetchApi("/session", { method: "POST", json: params });
  },

  updateSessionEntry(
    sessionId: string,
    entryId: string,
    data: { buyIn?: number; rebuy?: number; result?: number },
  ): Promise<{ entry: SessionEntry }> {
    return fetchApi(`/session/${sessionId}/entry/${entryId}`, {
      method: "PATCH",
      json: data,
    });
  },

  closeSession(
    sessionId: string,
  ): Promise<{ session: Session; ranking: { userId: string; name: string; result: number }[] }> {
    return fetchApi(`/session/${sessionId}/close`, { method: "POST" });
  },

  addSessionEntry(sessionId: string, userId: string): Promise<{ entry: SessionEntry }> {
    return fetchApi(`/session/${sessionId}/entry`, {
      method: "POST",
      json: { userId },
    });
  },

  cancelSession(sessionId: string): Promise<{ ok: boolean }> {
    return fetchApi(`/session/${sessionId}/cancel`, { method: "POST" });
  },

  updateSessionMeta(sessionId: string, data: { name?: string }): Promise<{ session: Session }> {
    return fetchApi(`/session/${sessionId}`, { method: "PATCH", json: data });
  },

  deleteSession(sessionId: string): Promise<void> {
    return fetchApi(`/session/${sessionId}`, { method: "DELETE" });
  },

  deleteSessionEntry(sessionId: string, entryId: string): Promise<void> {
    return fetchApi(`/session/${sessionId}/entry/${entryId}`, { method: "DELETE" });
  },

  // Betting Gambetta : joueurs ArcMonkey + matchs
  getBettingPlayers(): Promise<{ players: ArcMonkeyPlayer[] }> {
    return fetchApi("/betting/players");
  },

  createBettingPlayer(params: {
    name: string;
    steamProfileUrl: string;
    steamDisplayName?: string;
    userId?: string | null;
  }): Promise<{ player: ArcMonkeyPlayer }> {
    return fetchApi("/betting/players", { method: "POST", json: params });
  },

  updateBettingPlayer(
    id: string,
    data: { name?: string; steamProfileUrl?: string; steamDisplayName?: string | null; userId?: string | null; active?: boolean },
  ): Promise<{ player: ArcMonkeyPlayer }> {
    return fetchApi(`/betting/players/${id}`, { method: "PATCH", json: data });
  },

  deleteBettingPlayer(id: string): Promise<void> {
    return fetchApi(`/betting/players/${id}`, { method: "DELETE" });
  },

  getNextMatch(): Promise<{ match: BettingMatch | null }> {
    return fetchApi("/betting/matches/next");
  },

  getMatch(matchId: string): Promise<{ match: BettingMatch }> {
    return fetchApi(`/betting/matches/${matchId}`);
  },

  createMatch(params: {
    title?: string | null;
    opponent: string;
    format?: string;
    scheduledAt: string;
    faceitMatchUrl?: string | null;
    playerIds: string[];
    maxStakePerBet?: number | null;
    maxStakePerMatch?: number | null;
  }): Promise<{ matchId: string }> {
    return fetchApi("/betting/matches", { method: "POST", json: params });
  },

  getMatches(params?: { status?: string; fromDate?: string; toDate?: string; opponent?: string }): Promise<{ matches: BettingMatch[] }> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.fromDate) q.set("fromDate", params.fromDate);
    if (params?.toDate) q.set("toDate", params.toDate);
    if (params?.opponent) q.set("opponent", params.opponent);
    const query = q.toString();
    return fetchApi(`/betting/matches${query ? `?${query}` : ""}`);
  },

  getMyBets(): Promise<{
    bets: Array<{
      id: string;
      matchId: string;
      amount: number;
      betType: string;
      payload: Record<string, unknown>;
      status: string;
      createdAt: string;
      match: { id: string; title: string | null; opponent: string; format: string; scheduledAt: string; status: string } | null;
      gain: number | null;
    }>;
  }> {
    return fetchApi("/betting/me/bets");
  },

  updateMatch(
    id: string,
    data: {
      title?: string | null;
      opponent?: string;
      format?: string;
      status?: string;
      scheduledAt?: string;
      faceitMatchUrl?: string | null;
      playerIds?: string[];
      maxStakePerBet?: number | null;
      maxStakePerMatch?: number | null;
    },
  ): Promise<{ ok: boolean }> {
    return fetchApi(`/betting/matches/${id}`, { method: "PATCH", json: data });
  },

  getSettlement(matchId: string): Promise<{
    match: BettingMatch;
    outcomeGroups: {
      key: string;
      betType: string;
      payload: Record<string, unknown>;
      bets: { id: string; userId: string; amount: number; userName: string }[];
    }[];
  }> {
    return fetchApi(`/betting/matches/${matchId}/settlement`);
  },

  settleMatch(matchId: string, results: Record<string, "won" | "lost">): Promise<{ ok: boolean }> {
    return fetchApi(`/betting/matches/${matchId}/settle`, { method: "POST", json: { results } });
  },

  autoSettleMatchFromFaceit(matchId: string, url?: string): Promise<{ ok: boolean }> {
    return fetchApi(`/betting/matches/${matchId}/autosettle-from-faceit`, {
      method: "POST",
      json: url ? { url } : {},
    });
  },

  debugFaceit(url: string): Promise<{
    matchId: string;
    winner: string;
    scoreArc: number;
    scoreOpp: number;
    players: {
      nickname: string;
      kills: number;
      pentaKills: number;
      quadKills: number;
      rws: number;
      killThresholds: { "<15": boolean; ">15": boolean; ">30": boolean; ">50": boolean; ">60": boolean; ">70": boolean };
      ace: boolean;
      quadKill: boolean;
    }[];
  }> {
    return fetchApi("/betting/matches/faceit-debug", {
      method: "POST",
      json: { url },
    });
  },

  deleteMatch(id: string): Promise<void> {
    return fetchApi(`/betting/matches/${id}`, { method: "DELETE" });
  },

  getBets(matchId: string): Promise<{ bets: Bet[] }> {
    return fetchApi(`/betting/matches/${matchId}/bets`);
  },

  createBet(
    matchId: string,
    params: { amount: number; betType: Bet["betType"]; payload: Record<string, unknown> },
  ): Promise<{ ok: boolean }> {
    return fetchApi(`/betting/matches/${matchId}/bets`, { method: "POST", json: params });
  },

  cancelBet(matchId: string, betId: string): Promise<void> {
    return fetchApi(`/betting/matches/${matchId}/bets/${betId}`, { method: "DELETE" });
  },
};
