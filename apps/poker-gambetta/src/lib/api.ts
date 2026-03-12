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

  getProfile(userId: string): Promise<{ user: UserProfile; balance: number; badges: UserBadge[] }> {
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

  /** Prochain match ArcMonkey (pour afficher la carte « Parier » sur l’accueil Poker). */
  getNextBettingMatch(): Promise<{ match: { id: string; title?: string | null; opponent: string; format?: string; scheduledAt: string; status: string; isLive?: boolean } | null }> {
    return fetchApi("/betting/matches/next");
  },
};
