import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LedgerEntry } from "../lib/api";

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export default function DealerPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const user = me?.user ?? null;
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });
  const players = users.filter(
    (u) => u.role === "player" || (user && u.id === user.id),
  );
  const [targetUserId, setTargetUserId] = useState("");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: playerEntries = [], refetch: refetchEntries } = useQuery({
    queryKey: ["ledger", targetUserId],
    queryFn: () => api.getLedger({ userId: targetUserId }),
    enabled: !!targetUserId,
  });

  const createMutation = useMutation({
    mutationFn: (params: { userId: string; amount: number; note: string }) =>
      api.createEntry(params.userId, params.amount, params.note),
    onSuccess: () => {
      setOk("Entrée ajoutée.");
      setAmount("0");
      setNote("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      refetchEntries();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      api.updateEntry(id, { amount, note }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      refetchEntries();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      refetchEntries();
    },
  });

  function submit() {
    setError("");
    setOk("");
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setError("Montant invalide (doit être un nombre non nul).");
      return;
    }
    if (!targetUserId) {
      setError("Choisis un joueur.");
      return;
    }
    createMutation.mutate({
      userId: targetUserId,
      amount: parsed,
      note: note.trim() || "Ajustement",
    });
  }

  function startEdit(e: LedgerEntry) {
    setEditingId(e.id);
    setEditAmount(String(e.amount));
    setEditNote(e.note);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    if (!editingId) return;
    const parsed = Number(editAmount);
    if (!Number.isFinite(parsed)) return;
    updateMutation.mutate({
      id: editingId,
      amount: parsed,
      note: editNote.trim() || "Ajustement",
    });
  }

  if (!user) return null;

  return (
    <div className="grid">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Croupier</h2>

        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
              Joueur
            </label>
            <select
              className="select"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
            >
              <option value="">Choisir un joueur</option>
              {players.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
              Delta (ex: 10, -5)
            </label>
            <input
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              inputMode="decimal"
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Note
          </label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Session du 14/02, cave, side pot..."
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>
            {error}
          </div>
        )}
        {ok && (
          <div style={{ marginTop: 12, color: "#0a7a2f", fontWeight: 700 }}>
            {ok}
          </div>
        )}

        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button
            className="btn"
            onClick={submit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Ajout…" : "Ajouter"}
          </button>
        </div>

        {targetUserId && (
          <>
            <h3 style={{ marginTop: 24, marginBottom: 8 }}>Historique du joueur</h3>
            {playerEntries.length === 0 ? (
              <p style={{ color: "#444" }}>Aucune entrée pour ce joueur.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Delta</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {playerEntries.map((e) => (
                    <tr key={e.id}>
                      {editingId === e.id ? (
                        <>
                          <td>{formatDate(e.createdAt)}</td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              value={editAmount}
                              onChange={(ev) => setEditAmount(ev.target.value)}
                              style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={editNote}
                              onChange={(ev) => setEditNote(ev.target.value)}
                              style={{ minWidth: 120 }}
                            />
                          </td>
                          <td>
                            <button type="button" className="btn" onClick={saveEdit}>
                              Sauvegarder
                            </button>{" "}
                            <button type="button" className="btn" onClick={cancelEdit}>
                              Annuler
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatDate(e.createdAt)}</td>
                          <td style={{ fontWeight: 800 }}>{formatAmount(e.amount)}</td>
                          <td>{e.note}</td>
                          <td>
                            <button type="button" className="btn" onClick={() => startEdit(e)}>
                              Modifier
                            </button>{" "}
                            <button
                              type="button"
                              className="btn"
                              onClick={() => deleteMutation.mutate(e.id)}
                            >
                              Supprimer
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
