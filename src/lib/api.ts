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

  getLeaderboard(): Promise<(User & { balance: number })[]> {
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
};
