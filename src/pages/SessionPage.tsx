import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Session, type SessionEntry } from "../lib/api";

type SessionType = "sitngo" | "tournoi";

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount}`;
}

export default function SessionPage() {
  const queryClient = useQueryClient();
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const me = meData?.user ?? null;

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });

  const players = useMemo(
    () =>
      users.filter(
        (u) => u.role === "player" || (me && u.id === me.id),
      ),
    [users, me],
  );

  const { data: current = { session: null } } = useQuery({
    queryKey: ["session", "current"],
    queryFn: () => api.getCurrentSession(),
  });

  const [type, setType] = useState<SessionType>("sitngo");
  const [name, setName] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [closingRanking, setClosingRanking] = useState<
    { userId: string; name: string; result: number }[] | null
  >(null);
  const [newPlayerId, setNewPlayerId] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>("");

  const createSessionMutation = useMutation({
    mutationFn: (params: { type: SessionType; name?: string; playerIds: string[]; buyIn?: number }) =>
      api.createSession(params),
    onSuccess: () => {
      setError("");
      setClosingRanking(null);
      queryClient.invalidateQueries({ queryKey: ["session", "current"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateEntryMutation = useMutation({
    mutationFn: (args: {
      sessionId: string;
      entryId: string;
      data: { buyIn?: number; rebuy?: number; result?: number };
    }) => api.updateSessionEntry(args.sessionId, args.entryId, args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "current"] });
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.closeSession(sessionId),
    onSuccess: (data) => {
      setClosingRanking(data.ranking);
      queryClient.invalidateQueries({ queryKey: ["session", "current"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["ledger", "latest"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.cancelSession(sessionId),
    onSuccess: () => {
      setClosingRanking(null);
      queryClient.invalidateQueries({ queryKey: ["session", "current"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!me) return null;

  const session: Session | null = current.session;
  const isDealer = me.role === "dealer";

  const { data: history = { sessions: [] } } = useQuery({
    queryKey: ["session", "history"],
    queryFn: () => api.getSessions(),
  });

  // Ordre d'affichage figé au premier chargement de la session (évite que les lignes bougent au refetch)
  const entryOrderRef = useRef<{ sessionId: string; order: string[] }>({ sessionId: "", order: [] });
  const displayedEntries = useMemo(() => {
    if (!session?.entries?.length) return [];
    if (entryOrderRef.current.sessionId !== session.id) {
      entryOrderRef.current = { sessionId: session.id, order: session.entries.map((e) => e.id) };
    }
    const order = entryOrderRef.current.order;
    return [...session.entries].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [session?.id, session?.entries]);

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleCreateSession() {
    setError("");
    setClosingRanking(null);
    if (!selectedPlayerIds.length) {
      setError("Choisis au moins un joueur pour la session.");
      return;
    }
    createSessionMutation.mutate({
      type,
      name: name.trim() || undefined,
      playerIds: selectedPlayerIds,
    });
  }

  function handleEntryChange(
    sessionId: string,
    entry: SessionEntry,
    field: "buyIn" | "rebuy" | "result",
    value: string,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    updateEntryMutation.mutate({
      sessionId,
      entryId: entry.id,
      data: { [field]: parsed },
    } as any);
  }

  function handleCloseSession(id: string) {
    if (!window.confirm("Mettre fin à la partie et enregistrer les résultats ?")) return;
    setError("");
    closeSessionMutation.mutate(id);
  }

  function handleCancelSession(id: string) {
    if (!window.confirm("Annuler la session sans enregistrer les résultats ?")) return;
    setError("");
    cancelSessionMutation.mutate(id);
  }

  function startEditSession(s: Session) {
    setEditingSessionId(s.id);
    setEditingSessionName(s.name ?? "");
  }

  async function saveEditSession(id: string) {
    try {
      await api.updateSessionMeta(id, { name: editingSessionName.trim() || undefined });
      setEditingSessionId(null);
      setEditingSessionName("");
      queryClient.invalidateQueries({ queryKey: ["session", "history"] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Supprimer cette session de l'historique ?")) return;
    try {
      await api.deleteSession(id);
      queryClient.invalidateQueries({ queryKey: ["session", "history"] });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          Session de jeu{" "}
          {session && (
            <span className="badge">
              {session.type === "tournoi" ? "Tournoi" : "Sit & Go"}
            </span>
          )}
        </h2>

        {isDealer && !session ? (
          <>
            <p style={{ color: "#444" }}>
              Crée une nouvelle session pour la soirée : choisis les joueurs et le type de partie.
            </p>

            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Type de partie
                </label>
                <div className="row">
                  <label>
                    <input
                      type="radio"
                      name="session-type"
                      value="sitngo"
                      checked={type === "sitngo"}
                      onChange={() => setType("sitngo")}
                    />{" "}
                    Sit &amp; Go
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="session-type"
                      value="tournoi"
                      checked={type === "tournoi"}
                      onChange={() => setType("tournoi")}
                    />{" "}
                    Tournoi
                  </label>
                </div>

                <label style={{ display: "block", margin: "12px 0 6px", fontWeight: 600 }}>
                  Nom (optionnel)
                </label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Soirée du 15/03"
                />
              </div>

              <div>
                <label style={{ display: "block", margin: "0 0 6px", fontWeight: 600 }}>
                  Joueurs
                </label>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #eef0f4", borderRadius: 8, padding: 8 }}>
                  {players.map((u) => (
                    <label key={u.id} style={{ display: "block", marginBottom: 4 }}>
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.includes(u.id)}
                        onChange={() => togglePlayer(u.id)}
                      />{" "}
                      {u.name}
                    </label>
                  ))}
                  {players.length === 0 && (
                    <p style={{ color: "#666", margin: 0 }}>Aucun joueur disponible.</p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>{error}</div>
            )}

            <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
              <button
                className="btn"
                onClick={handleCreateSession}
                disabled={createSessionMutation.isPending}
              >
                {createSessionMutation.isPending ? "Création…" : "Créer la session"}
              </button>
            </div>
          </>
        ) : isDealer && session ? (
          <>
            <p style={{ color: "#444" }}>
              Session en cours :{" "}
              <strong>
                {session.name || (session.type === "tournoi" ? "Tournoi" : "Sit &amp; Go")} (
                {new Date(session.createdAt).toLocaleDateString("fr-FR")})
              </strong>
            </p>

            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Joueur</th>
                  <th>Buy-in</th>
                  <th>Rebuy</th>
                  <th>Résultat</th>
                  <th className="col-gain">Gain</th>
                  {isDealer && <th></th>}
                </tr>
              </thead>
              <tbody>
                {displayedEntries.map((e) => {
                  const net = e.result - e.buyIn - e.rebuy;
                  return (
                    <tr key={e.id}>
                      <td>{e.user.name}</td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 90 }}
                          type="number"
                          defaultValue={e.buyIn}
                          onBlur={(ev) =>
                            handleEntryChange(session.id, e, "buyIn", ev.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 90 }}
                          type="number"
                          defaultValue={e.rebuy}
                          onBlur={(ev) =>
                            handleEntryChange(session.id, e, "rebuy", ev.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 110 }}
                          type="number"
                          defaultValue={e.result}
                          onBlur={(ev) =>
                            handleEntryChange(session.id, e, "result", ev.target.value)
                          }
                        />
                      </td>
                      <td className="col-gain" style={{ fontWeight: 700 }}>
                        {net === 0 ? "" : formatAmount(net)}
                      </td>
                      {isDealer && (
                        <td>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            title="Retirer ce joueur de la session"
                            onClick={() => {
                              if (!window.confirm("Retirer ce joueur de la session en cours ?")) {
                                return;
                              }
                              api
                                .deleteSessionEntry(session.id, e.id)
                                .then(() =>
                                  queryClient.invalidateQueries({
                                    queryKey: ["session", "current"],
                                  }),
                                )
                                .catch((err) => setError((err as Error).message));
                            }}
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {session.type === "sitngo" && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Ajouter un joueur (Sit &amp; Go)</h3>
                <div className="row">
                  <select
                    className="select"
                    style={{ maxWidth: 220 }}
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                  >
                    <option value="">Choisir un joueur</option>
                    {players
                      .filter((p) => !session.entries.some((e) => e.userId === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn"
                    onClick={() => {
                      if (!newPlayerId) return;
                      api
                        .addSessionEntry(session.id, newPlayerId)
                        .then(() => {
                          setNewPlayerId("");
                          queryClient.invalidateQueries({ queryKey: ["session", "current"] });
                        })
                        .catch((err) => setError((err as Error).message));
                    }}
                    disabled={!newPlayerId}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>{error}</div>
            )}

            <div className="row" style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
              <button
                className="btn secondary"
                onClick={() => handleCancelSession(session.id)}
                disabled={cancelSessionMutation.isPending}
              >
                Annuler
              </button>
              <button
                className="btn"
                onClick={() => handleCloseSession(session.id)}
                disabled={closeSessionMutation.isPending}
              >
                {closeSessionMutation.isPending ? "Clôture…" : "Mettre fin à la partie"}
              </button>
            </div>

            {closingRanking && (
              <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Classement de la session</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="col-rank">#</th>
                      <th className="col-player">Joueur</th>
                      <th className="col-gain">Gain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closingRanking.map((r, idx) => {
                      const rank = idx + 1;
                      const isCurrentUser = r.userId === me?.id;
                      const rowClasses = [
                        isCurrentUser ? "row-current-user" : "",
                        !isCurrentUser && rank === 1 ? "row-rank-1" : "",
                        !isCurrentUser && rank === 2 ? "row-rank-2" : "",
                        !isCurrentUser && rank === 3 ? "row-rank-3" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined;
                      return (
                      <tr key={r.userId} className={rowClasses}>
                        <td className="col-rank">
                          <span
                            className={
                              idx === 0
                                ? "rank-pos-1"
                                : idx === 1
                                  ? "rank-pos-2"
                                  : idx === 2
                                    ? "rank-pos-3"
                                    : undefined
                            }
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="col-player">
                          {r.name}
                          {idx === 0 && <span className="crown-icon" aria-hidden>👑</span>}
                        </td>
                        <td className="col-gain" style={{ fontWeight: 800 }}>
                          {r.result === 0 ? "" : formatAmount(r.result)}
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        <div style={{ marginTop: 24, borderTop: "1px solid #eef0f4", paddingTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Historique des sessions</h3>
          {(!history.sessions || history.sessions.length === 0) ? (
            <p style={{ color: "#444" }}>Aucune session clôturée pour l’instant.</p>
          ) : (
            history.sessions.map((s) => {
              const ranking = [...s.entries]
                .map((e) => ({
                  userId: e.userId,
                  name: e.user.name,
                  result: e.result - e.buyIn - e.rebuy,
                }))
                .sort((a, b) => b.result - a.result);

              return (
                <div key={s.id} className="card" style={{ marginTop: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>
                      {editingSessionId === s.id ? (
                        <input
                          className="input"
                          style={{ maxWidth: 260 }}
                          value={editingSessionName}
                          onChange={(e) => setEditingSessionName(e.target.value)}
                        />
                      ) : (
                        <>
                          {s.name || (s.type === "tournoi" ? "Tournoi" : "Sit & Go")} –{" "}
                          {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                        </>
                      )}
                    </h4>
                    {isDealer && (
                      <div className="row" style={{ gap: 8 }}>
                        {editingSessionId === s.id ? (
                          <>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => saveEditSession(s.id)}
                            >
                              Sauver
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => {
                                setEditingSessionId(null);
                                setEditingSessionName("");
                              }}
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => startEditSession(s)}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => deleteSession(s.id)}
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="col-rank">#</th>
                        <th className="col-player">Joueur</th>
                        <th className="col-gain">Gain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r, idx) => {
                        const rank = idx + 1;
                        const isCurrentUser = r.userId === me?.id;
                        const rowClasses = [
                          isCurrentUser ? "row-current-user" : "",
                          !isCurrentUser && rank === 1 ? "row-rank-1" : "",
                          !isCurrentUser && rank === 2 ? "row-rank-2" : "",
                          !isCurrentUser && rank === 3 ? "row-rank-3" : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined;
                        return (
                        <tr key={r.userId} className={rowClasses}>
                          <td className="col-rank">
                            <span
                              className={
                                idx === 0
                                  ? "rank-pos-1"
                                  : idx === 1
                                    ? "rank-pos-2"
                                    : idx === 2
                                      ? "rank-pos-3"
                                      : undefined
                              }
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="col-player">
                            {r.name}
                            {idx === 0 && <span className="crown-icon" aria-hidden>👑</span>}
                          </td>
                          <td className="col-gain" style={{ fontWeight: 800 }}>
                            {r.result === 0 ? "" : formatAmount(r.result)}
                          </td>
                        </tr>
                        ); })}
                    </tbody>
                  </table>

                  {isDealer && editingSessionId === s.id && (
                    <table className="table" style={{ marginTop: 12 }}>
                      <thead>
                        <tr>
                          <th>Joueur</th>
                          <th>Buy-in</th>
                          <th>Rebuy</th>
                          <th>Résultat</th>
                          <th>Gain</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.entries.map((e) => {
                          const net = e.result - e.buyIn - e.rebuy;
                          return (
                            <tr key={e.id}>
                              <td>{e.user.name}</td>
                              <td>
                                <input
                                  className="input"
                                  style={{ maxWidth: 90 }}
                                  type="number"
                                  defaultValue={e.buyIn}
                                  onBlur={(ev) =>
                                    api
                                      .updateSessionEntry(s.id, e.id, {
                                        buyIn: Number(ev.target.value),
                                      })
                                      .then(() =>
                                        queryClient.invalidateQueries({
                                          queryKey: ["session", "history"],
                                        }),
                                      )
                                      .catch((err) => setError((err as Error).message))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="input"
                                  style={{ maxWidth: 90 }}
                                  type="number"
                                  defaultValue={e.rebuy}
                                  onBlur={(ev) =>
                                    api
                                      .updateSessionEntry(s.id, e.id, {
                                        rebuy: Number(ev.target.value),
                                      })
                                      .then(() =>
                                        queryClient.invalidateQueries({
                                          queryKey: ["session", "history"],
                                        }),
                                      )
                                      .catch((err) => setError((err as Error).message))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="input"
                                  style={{ maxWidth: 110 }}
                                  type="number"
                                  defaultValue={e.result}
                                  onBlur={(ev) =>
                                    api
                                      .updateSessionEntry(s.id, e.id, {
                                        result: Number(ev.target.value),
                                      })
                                      .then(() =>
                                        queryClient.invalidateQueries({
                                          queryKey: ["session", "history"],
                                        }),
                                      )
                                      .catch((err) => setError((err as Error).message))
                                  }
                                />
                              </td>
                              <td className="col-gain" style={{ fontWeight: 700 }}>
                                {net === 0 ? "" : formatAmount(net)}
                              </td>
                              <td>
                                <button
                                  className="btn secondary"
                                  type="button"
                                  onClick={() =>
                                    api
                                      .deleteSessionEntry(s.id, e.id)
                                      .then(() =>
                                        queryClient.invalidateQueries({
                                          queryKey: ["session", "history"],
                                        }),
                                      )
                                      .catch((err) => setError((err as Error).message))
                                  }
                                >
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

