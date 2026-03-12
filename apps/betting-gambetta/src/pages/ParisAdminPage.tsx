import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BettingMatch } from "../lib/api";
import { describeOutcomeFr } from "../lib/betDescriptions";
import { toast } from "sonner";

type SettlementGroup = {
  key: string;
  betType: string;
  payload: Record<string, unknown>;
  bets: { id: string; userId: string; amount: number; userName: string }[];
};

export default function ParisAdminPage() {
  const queryClient = useQueryClient();
  const [closingMatchId, setClosingMatchId] = useState<string | null>(null);
  const [settleMatchId, setSettleMatchId] = useState<string | null>(null);
  const [groupResults, setGroupResults] = useState<Record<string, "won" | "lost">>({});
  const [faceitUrl, setFaceitUrl] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOpponent, setFilterOpponent] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;
  const isKillian = user?.name === "Killian";

  const { data: matchesData } = useQuery({
    queryKey: ["betting-matches-admin", filterStatus, filterOpponent],
    queryFn: () =>
      api.getMatches({
        status: filterStatus || undefined,
        opponent: filterOpponent.trim() || undefined,
      }),
    enabled: !!user && isKillian,
  });

  const { data: settlementData, isLoading: settlementLoading } = useQuery({
    queryKey: ["betting-settlement", settleMatchId],
    queryFn: () => api.getSettlement(settleMatchId!),
    enabled: !!settleMatchId && isKillian,
  });

  const closeMatch = useMutation({
    mutationFn: (matchId: string) => api.updateMatch(matchId, { status: "finished" }),
    onSuccess: (_, matchId) => {
      setClosingMatchId(null);
      setSettleMatchId(matchId);
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
      queryClient.invalidateQueries({ queryKey: ["betting-matches-admin"] });
      toast.success("Match fermé. Tu peux maintenant régler les paris.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settleMatch = useMutation({
    mutationFn: (matchId: string) => api.settleMatch(matchId, groupResults),
    onSuccess: (_, matchId) => {
      setSettleMatchId(null);
      setGroupResults({});
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
      queryClient.invalidateQueries({ queryKey: ["betting-settlement", matchId] });
      toast.success("Règlement enregistré. Les gains ont été crédités.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const autoSettleMatch = useMutation({
    mutationFn: (matchId: string) => api.autoSettleMatchFromFaceit(matchId, faceitUrl.trim() || undefined),
    onSuccess: async (_, matchId) => {
      const urlToReuse = faceitUrl.trim() || undefined;
      setFaceitUrl("");
      setSettleMatchId(null);
      setGroupResults({});
      queryClient.invalidateQueries({ queryKey: ["betting-matches"] });
      queryClient.invalidateQueries({ queryKey: ["betting-settlement", matchId] });
      toast.success("Règlement automatique enregistré depuis Faceit.");

      // On planifie quelques relances automatiques pour capter les stats tardives (RWS etc.).
      const delays = [2 * 60_000, 5 * 60_000, 10 * 60_000];
      delays.forEach((delay) => {
        window.setTimeout(() => {
          api.autoSettleMatchFromFaceit(matchId, urlToReuse).catch(() => {
            // on ignore les erreurs silencieusement, l'admin peut toujours relancer manuellement
          });
        }, delay);
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const debugFaceit = useMutation({
    mutationFn: () => api.debugFaceit(faceitUrl.trim()),
    onSuccess: (data) => {
      // Log complet dans la console du navigateur
      // eslint-disable-next-line no-console
      console.log("[Betting][Faceit][Debug]", data);
      toast.success("Debug Faceit OK (vois la console).");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const matches: BettingMatch[] = matchesData?.matches ?? [];
  const match = settlementData?.match;
  const outcomeGroups: SettlementGroup[] = settlementData?.outcomeGroups ?? [];
  const players = match?.players ?? [];

  const handleSetResult = (key: string, result: "won" | "lost") => {
    setGroupResults((prev) => ({ ...prev, [key]: result }));
  };

  const allGroupsSet =
    outcomeGroups.length > 0 &&
    outcomeGroups.every((g) => groupResults[g.key] === "won" || groupResults[g.key] === "lost");

  if (!user) {
    return (
      <div className="card">
        <p>Connexion requise.</p>
        <Link to="/login">Se connecter</Link>
      </div>
    );
  }

  if (!isKillian) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Admin paris</h2>
        <p>Cette page est réservée à Killian.</p>
        <Link to="/" className="btn secondary">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Admin paris</h2>
      <p className="paris-admin-intro">
        Ferme un match quand il est terminé, puis règle chaque situation pariée (gagné / perdu). Les gains (mise ×
        multiplicateur selon le type de pari) et les pertes sont enregistrés dans les bankrolls.
      </p>
      <Link to="/" className="btn secondary" style={{ marginBottom: 16 }}>
        ← Retour à l&apos;accueil
      </Link>

      <section className="paris-admin-matches">
        <h3>Matchs</h3>
        <div className="admin-filters" style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
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
        {matches.length === 0 ? (
          <p>Aucun match.</p>
        ) : (
          <ul className="paris-admin-match-list">
            {matches.map((m) => (
              <li key={m.id} className="paris-admin-match-item card">
                <div className="paris-admin-match-head">
                  <div>
                    <strong>
                      {m.title ? `${m.title} — ` : ""}ArcMonkey vs {m.opponent}
                    </strong>
                    <span className="paris-admin-match-format">({m.format ?? "BO3"})</span>
                    <div className="paris-admin-match-meta">
                      {new Date(m.scheduledAt).toLocaleString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      <span className={`paris-admin-match-status paris-admin-match-status-${m.status}`}>
                        {m.status === "upcoming" && "À venir"}
                        {m.status === "finished" && "Terminé"}
                        {m.status === "cancelled" && "Annulé"}
                      </span>
                    </div>
                  </div>
                  <div className="paris-admin-match-actions">
                    {m.status === "upcoming" && (
                      <button
                        type="button"
                        className="btn"
                        disabled={closeMatch.isPending && closingMatchId === m.id}
                        onClick={() => {
                          if (window.confirm("Fermer ce match ? Les paris ne pourront plus être pris.")) {
                            setClosingMatchId(m.id);
                            closeMatch.mutate(m.id);
                          }
                        }}
                      >
                        {closeMatch.isPending && closingMatchId === m.id ? "Fermeture…" : "Fermer le match"}
                      </button>
                    )}
                    {m.status === "finished" && (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          setSettleMatchId(m.id);
                          setGroupResults({});
                        }}
                      >
                        {settleMatchId === m.id ? "Règlement en cours" : "Régler les paris"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settleMatchId && (
        <section className="paris-admin-settlement card">
          <h3>Règlement des paris</h3>
          {match && (
            <p className="paris-admin-settlement-match">
              {match.title ? `${match.title} — ` : ""}ArcMonkey vs {match.opponent} ({match.format ?? "BO3"})
            </p>
          )}
          <button
            type="button"
            className="btn secondary paris-admin-settle-close"
            onClick={() => { setSettleMatchId(null); setGroupResults({}); }}
          >
            Fermer
          </button>

          <div className="form" style={{ marginTop: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="form-field">
              <span>Lien Faceit du match (pour règlement auto)</span>
              <input
                type="url"
                value={faceitUrl}
                onChange={(e) => setFaceitUrl(e.target.value)}
                placeholder="https://www.faceit.com/..."
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn secondary"
                disabled={!settleMatchId || autoSettleMatch.isPending}
                onClick={() => settleMatchId && autoSettleMatch.mutate(settleMatchId)}
              >
                {autoSettleMatch.isPending ? "Règlement auto en cours…" : "Régler automatiquement depuis Faceit"}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={!faceitUrl.trim() || debugFaceit.isPending}
                onClick={() => debugFaceit.mutate()}
              >
                {debugFaceit.isPending ? "Debug Faceit…" : "Debug Faceit (logs)"}
              </button>
            </div>
          </div>

          {settlementLoading ? (
            <p>Chargement…</p>
          ) : outcomeGroups.length === 0 ? (
            <p>Aucun pari à régler pour ce match.</p>
          ) : (
            <>
              <p className="paris-admin-settlement-hint">
                Pour chaque situation, indique si le pari est gagnant ou perdant.
              </p>
              <ul className="paris-admin-outcome-list">
                {outcomeGroups.map((g) => (
                  <li key={g.key} className="paris-admin-outcome-item">
                    <div className="paris-admin-outcome-desc">
                      {describeOutcomeFr(g.betType, g.payload, players)}
                    </div>
                    <div className="paris-admin-outcome-bets">
                      {g.bets.map((b) => (
                        <span key={b.id} className="paris-admin-outcome-bet-chip">
                          {b.userName} : {b.amount} $
                        </span>
                      ))}
                    </div>
                    <div className="paris-admin-outcome-actions">
                      <button
                        type="button"
                        className={groupResults[g.key] === "won" ? "btn" : "btn secondary"}
                        onClick={() => handleSetResult(g.key, "won")}
                      >
                        Gagné
                      </button>
                      <button
                        type="button"
                        className={groupResults[g.key] === "lost" ? "btn" : "btn secondary"}
                        onClick={() => handleSetResult(g.key, "lost")}
                      >
                        Perdu
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn"
                disabled={!allGroupsSet || settleMatch.isPending}
                onClick={() => settleMatchId && settleMatch.mutate(settleMatchId)}
              >
                {settleMatch.isPending ? "Enregistrement…" : "Valider le règlement"}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
