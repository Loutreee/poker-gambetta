import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ArcMonkeyPlayer, type BettingMatch } from "../lib/api";

export default function MatchPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;
  const isKillian = user?.name === "Killian";

  const { data: playersData, isLoading: playersLoading } = useQuery({
    queryKey: ["betting-players"],
    queryFn: () => api.getBettingPlayers(),
    enabled: !!user,
  });
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterOpponent, setFilterOpponent] = useState("");

  const { data: matchesData } = useQuery({
    queryKey: ["betting-matches", filterStatus, filterFrom, filterTo, filterOpponent],
    queryFn: () =>
      api.getMatches({
        status: filterStatus || undefined,
        fromDate: filterFrom || undefined,
        toDate: filterTo || undefined,
        opponent: filterOpponent.trim() || undefined,
      }),
    enabled: !!user && isKillian,
  });

  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [format, setFormat] = useState<"BO1" | "BO3" | "BO5">("BO3");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [faceitUrl, setFaceitUrl] = useState("");
  const [maxStakePerBet, setMaxStakePerBet] = useState<string>("");
  const [maxStakePerMatch, setMaxStakePerMatch] = useState<string>("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const createMatch = useMutation({
    mutationFn: (payload: {
      title?: string | null;
      opponent: string;
      format?: string;
      scheduledAt: string;
      faceitMatchUrl?: string | null;
      playerIds: string[];
    }) => api.createMatch(payload),
    onSuccess: () => {
      setTitle("");
      setOpponent("");
      setFormat("BO3");
      setDate("");
      setTime("");
      setFaceitUrl("");
      setMaxStakePerBet("");
      setMaxStakePerMatch("");
      setSelectedPlayerIds([]);
      setEditingMatchId(null);
      queryClient.invalidateQueries({ queryKey: ["next-match"] });
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
    },
  });

  const updateMatch = useMutation({
    mutationFn: (payload: {
      id: string;
      title?: string | null;
      opponent: string;
      format?: string;
      scheduledAt: string;
      faceitMatchUrl?: string | null;
      playerIds: string[];
    }) =>
      api.updateMatch(payload.id, {
        title: payload.title,
        opponent: payload.opponent,
        format: payload.format,
        scheduledAt: payload.scheduledAt,
        faceitMatchUrl: payload.faceitMatchUrl,
        playerIds: payload.playerIds,
      }),
    onSuccess: () => {
      setEditingMatchId(null);
      setTitle("");
      setOpponent("");
      setFormat("BO3");
      setDate("");
      setTime("");
      setFaceitUrl("");
      setMaxStakePerBet("");
      setMaxStakePerMatch("");
      setSelectedPlayerIds([]);
      queryClient.invalidateQueries({ queryKey: ["next-match"] });
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
    },
  });

  const deleteMatch = useMutation({
    mutationFn: (id: string) => api.deleteMatch(id),
    onSuccess: () => {
      if (editingMatchId) setEditingMatchId(null);
      queryClient.invalidateQueries({ queryKey: ["next-match"] });
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
    },
  });

  if (!user) {
    return (
      <div className="card">
        <p>Connexion requise.</p>
      </div>
    );
  }

  if (!isKillian) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Matchs ArcMonkey</h2>
        <p>Cette page est réservée à Killian pour créer les matchs ArcMonkey.</p>
      </div>
    );
  }

  const players: ArcMonkeyPlayer[] = playersData?.players ?? [];
  const matches: BettingMatch[] = matchesData?.matches ?? [];

  const startEditMatch = (match: BettingMatch) => {
    setEditingMatchId(match.id);
    setTitle(match.title ?? "");
    setOpponent(match.opponent);
    setFormat((match.format === "BO1" || match.format === "BO5" ? match.format : "BO3") as "BO1" | "BO3" | "BO5");
    const d = new Date(match.scheduledAt);
    setDate(d.toISOString().slice(0, 10));
    setTime(d.toISOString().slice(11, 16));
    setFaceitUrl(match.faceitMatchUrl ?? "");
    setMaxStakePerBet(match.maxStakePerBet != null ? String(match.maxStakePerBet) : "");
    setMaxStakePerMatch(match.maxStakePerMatch != null ? String(match.maxStakePerMatch) : "");
    setSelectedPlayerIds(match.players.map((p) => p.id));
  };

  const handleTogglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim() || !date || !time || selectedPlayerIds.length === 0) {
      return;
    }
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    const payload = {
      title: title.trim() || undefined,
      opponent: opponent.trim(),
      format,
      scheduledAt,
      faceitMatchUrl: faceitUrl.trim() || undefined,
      playerIds: selectedPlayerIds,
      maxStakePerBet: maxStakePerBet.trim() ? Math.max(0, Math.floor(Number(maxStakePerBet))) : null,
      maxStakePerMatch: maxStakePerMatch.trim() ? Math.max(0, Math.floor(Number(maxStakePerMatch))) : null,
    };
    if (editingMatchId) {
      updateMatch.mutate({ id: editingMatchId, ...payload });
    } else {
      createMatch.mutate(payload);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Matchs ArcMonkey</h2>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Programme ici le <strong>prochain match CS d&apos;ArcMonkey</strong>.
        Il s&apos;affichera automatiquement dans la carte <strong>Prochain match</strong> de l&apos;accueil.
      </p>

      {playersLoading ? (
        <p>Chargement des joueurs ArcMonkey…</p>
      ) : players.length === 0 ? (
            <p>
          Aucun joueur ArcMonkey configuré pour l&apos;instant. Va d&apos;abord dans l&apos;onglet{" "}
          <strong>Équipe ArcMonkey</strong> pour créer la liste de base.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="form-field">
            <span>Titre du match (optionnel)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Demi-finale LAN, Match amical…"
            />
          </label>
          <label className="form-field">
            <span>Équipe adverse</span>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="Ex : Team A, Mix LAN, etc."
              required
            />
          </label>
          <label className="form-field">
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as "BO1" | "BO3" | "BO5")}>
              <option value="BO1">BO1</option>
              <option value="BO3">BO3</option>
              <option value="BO5">BO5</option>
            </select>
          </label>

          <label className="form-field">
            <span>Lien Faceit du match (optionnel)</span>
            <input
              type="url"
              value={faceitUrl}
              onChange={(e) => setFaceitUrl(e.target.value)}
              placeholder="https://www.faceit.com/..."
            />
          </label>

          <div className="form-grid-2">
            <label className="form-field">
              <span>Mise max par pari (optionnel, 0 = illimité)</span>
              <input
                type="number"
                min={0}
                value={maxStakePerBet}
                onChange={(e) => setMaxStakePerBet(e.target.value)}
                placeholder="Ex: 50"
              />
            </label>
            <label className="form-field">
              <span>Mise max totale par match (optionnel)</span>
              <input
                type="number"
                min={0}
                value={maxStakePerMatch}
                onChange={(e) => setMaxStakePerMatch(e.target.value)}
                placeholder="Ex: 200"
              />
            </label>
          </div>

          <div className="form-grid-2">
            <label className="form-field">
              <span>Date du match</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Heure (heure locale)</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-field">
            <span>Joueurs ArcMonkey pour ce match</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {players.map((p) => (
                <label key={p.id} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.includes(p.id)}
                    onChange={() => handleTogglePlayer(p.id)}
                  />
                  <span>{p.steamDisplayName || p.name}</span>
                  {!p.active && <span className="badge" style={{ marginLeft: 6 }}>inactif</span>}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn"
            disabled={
              (createMatch.isPending || updateMatch.isPending) ||
              !opponent.trim() ||
              !date ||
              !time ||
              selectedPlayerIds.length === 0
            }
          >
            {editingMatchId
              ? updateMatch.isPending
                ? "Mise à jour…"
                : "Mettre à jour le match"
              : createMatch.isPending
                ? "Création en cours…"
                : "Créer le match"}
          </button>

          {(createMatch.isError || updateMatch.isError) && (
            <p style={{ color: "#c00" }}>
              {((createMatch.error ?? updateMatch.error) as Error).message ?? "Erreur lors de l’enregistrement du match."}
            </p>
          )}
          {(createMatch.isSuccess || updateMatch.isSuccess) && (
            <p style={{ color: "#0a0" }}>Match enregistré. Il apparaît dans la liste et comme prochain match si la date est à venir.</p>
          )}
        </form>
      )}

      <div className="admin-filters" style={{ marginTop: 24, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem", color: "#555" }}>Statut</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
            style={{ minWidth: 120 }}
          >
            <option value="">Tous</option>
            <option value="upcoming">À venir</option>
            <option value="finished">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem", color: "#555" }}>Du</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="input"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem", color: "#555" }}>Au</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="input"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.85rem", color: "#555" }}>Adversaire</span>
          <input
            type="text"
            value={filterOpponent}
            onChange={(e) => setFilterOpponent(e.target.value)}
            placeholder="Rechercher…"
            className="input"
            style={{ minWidth: 140 }}
          />
        </label>
      </div>

      {matches.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Matchs existants</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.map((m) => (
              <li key={m.id} className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <strong>
                      {m.title ? `${m.title} — ` : ""}ArcMonkey vs {m.opponent}
                    </strong>
                    <span style={{ marginLeft: 8, fontSize: "0.85rem", color: "var(--violet-600)" }}>({m.format ?? "BO3"})</span>
                    <div style={{ fontSize: "0.85rem", color: "#555" }}>
                      {new Date(m.scheduledAt).toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 4 }}>
                      Line-up: {m.players.map((p) => p.steamDisplayName || p.name).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => startEditMatch(m)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon-danger"
                      onClick={() => {
                        if (window.confirm("Supprimer ce match ?")) {
                          deleteMatch.mutate(m.id);
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

