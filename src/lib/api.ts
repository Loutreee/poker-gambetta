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

  getUsers(): Promise<User[]> {
    return fetchApi("/users");
  },

  getLeaderboard(): Promise<(User & { balance: number; balanceDeltaWeek: number; rankChange: number })[]> {
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
};
