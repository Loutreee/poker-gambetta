import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebHaptics } from "web-haptics/react";
import { api, type BettingMatch, type BettingMatchPlayer, type Bet } from "../lib/api";
import { toast } from "sonner";

// Seuils exprimés directement en kills totaux sur l'ensemble du BO
const KILL_THRESHOLDS = ["<15", ">15", ">30", ">50", ">60", ">70"] as const;

type AmountsBySection = {
  victory: string;
  kills: string;
  ace: string;
  quadKill: string;
  mostKills: string;
  exactScore: string;
};

const initialAmounts: AmountsBySection = {
  victory: "",
  kills: "",
  ace: "",
  quadKill: "",
  mostKills: "",
  exactScore: "",
};

function getExactScoreOptions(format: string): { arc: number; opp: number }[] {
  if (format === "BO1") return [{ arc: 1, opp: 0 }, { arc: 0, opp: 1 }];
  if (format === "BO3") {
    return [
      { arc: 2, opp: 0 }, { arc: 2, opp: 1 }, { arc: 1, opp: 2 }, { arc: 0, opp: 2 },
    ];
  }
  if (format === "BO5") {
    return [
      { arc: 3, opp: 0 }, { arc: 3, opp: 1 }, { arc: 3, opp: 2 },
      { arc: 2, opp: 3 }, { arc: 1, opp: 3 }, { arc: 0, opp: 3 },
    ];
  }
  return [{ arc: 2, opp: 1 }, { arc: 1, opp: 2 }];
}

function findPlayerName(players: BettingMatchPlayer[], playerId?: string | null): string {
  if (!playerId) return "un joueur";
  const p = players.find((pl) => pl.id === playerId);
  return p ? p.steamDisplayName || p.name : "un joueur";
}

function describeBetFr(bet: Bet, players: BettingMatchPlayer[]): string {
  const payload = bet.payload as Record<string, unknown>;
  switch (bet.betType) {
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
      return bet.betType;
  }
}

function PlayerChoiceCards({
  players,
  selectedId,
  onSelect,
  onHaptic,
}: {
  players: BettingMatchPlayer[];
  selectedId: string;
  onSelect: (id: string) => void;
  onHaptic?: () => void;
}) {
  return (
    <div className="paris-player-cards">
      {players.map((p) => {
        const name = p.steamDisplayName || p.name;
        const isSelected = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className={`paris-player-card ${isSelected ? "paris-player-card-selected" : ""}`}
            onClick={() => { onHaptic?.(); onSelect(p.id); }}
          >
            <span className="paris-player-card-avatar-wrap">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt="" className="paris-player-card-avatar" />
              ) : (
                <span className="paris-player-card-avatar-placeholder">
                  {name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span className="paris-player-card-name">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

function AmountInput({
  value,
  onChange,
  placeholder = "0",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="paris-amount-field">
      <span className="paris-amount-label">Mise ($)</span>
      <input
        type="number"
        min={1}
        className="paris-amount-input input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}

export default function ParisPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const queryClient = useQueryClient();
  const { trigger } = useWebHaptics();
  const [amounts, setAmounts] = useState<AmountsBySection>(initialAmounts);
  const [victoryOutcome, setVictoryOutcome] = useState<"win" | "loss">("win");
  const [killsPlayerId, setKillsPlayerId] = useState("");
  const [killsThreshold, setKillsThreshold] = useState<string>(KILL_THRESHOLDS[0]);
  const [acePlayerId, setAcePlayerId] = useState("");
  const [exactScore, setExactScore] = useState<{ arc: number; opp: number } | null>(null);
  const [quadKillPlayerId, setQuadKillPlayerId] = useState("");
  const [mostKillsPlayerId, setMostKillsPlayerId] = useState("");

  const setAmount = (key: keyof AmountsBySection, value: string) => {
    setAmounts((prev) => ({ ...prev, [key]: value }));
  };

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;

  const { data: matchData, isLoading: matchLoading, error: matchError } = useQuery({
    queryKey: ["betting-match", matchId],
    queryFn: () => api.getMatch(matchId!),
    enabled: !!matchId,
  });

  const { data: profileData } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => api.getProfile(user!.id),
    enabled: !!user?.id,
  });

  const { data: betsData } = useQuery({
    queryKey: ["betting-bets", matchId],
    queryFn: () => api.getBets(matchId!),
    enabled: !!matchId && !!user,
  });

  const createBet = useMutation({
    mutationFn: (params: { amount: number; betType: Bet["betType"]; payload: Record<string, unknown> }) =>
      api.createBet(matchId!, params),
    onSuccess: (_, { betType }) => {
      queryClient.invalidateQueries({ queryKey: ["betting-bets", matchId] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Pari enregistré.");
      const key = betType === "VICTORY" ? "victory" : betType === "KILLS" ? "kills" : betType === "ACE" ? "ace" : betType === "QUAD_KILL" ? "quadKill" : betType === "MOST_KILLS" ? "mostKills" : "exactScore";
      setAmount(key, "");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelBet = useMutation({
    mutationFn: (betId: string) => api.cancelBet(matchId!, betId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betting-bets", matchId] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Pari annulé.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const match: BettingMatch | null = matchData?.match ?? null;
  const matchStarted = match ? (match.isLive ?? new Date(match.scheduledAt) <= new Date()) : false;
  const balance = profileData?.balance ?? 0;
  const pendingStakes = profileData?.pendingStakes ?? 0;
  const availableBalance = balance - pendingStakes;
  const players: BettingMatchPlayer[] = match?.players ?? [];
  const myBets: Bet[] = (betsData?.bets ?? []).filter((b) => b.userId === user?.id);

  const getAmountNum = (key: keyof AmountsBySection) => Math.floor(Number(amounts[key]));
  const canAfford = (key: keyof AmountsBySection) => {
    const amt = getAmountNum(key);
    return amt >= 1 && amt <= availableBalance;
  };

  const handleBet = (betType: Bet["betType"], payload: Record<string, unknown>, amountKey: keyof AmountsBySection) => {
    const amt = getAmountNum(amountKey);
    if (!amt || amt < 1) {
      toast.error("Montant invalide.");
      return;
    }
    if (amt > availableBalance) {
      toast.error("Solde disponible insuffisant.");
      return;
    }
    createBet.mutate({ amount: amt, betType, payload });
  };

  const exactScoreOptions = match ? getExactScoreOptions(match.format ?? "BO3") : [];

  if (!user) {
    return (
      <div className="card">
        <p>Connexion requise pour parier.</p>
        <Link to="/login">Se connecter</Link>
      </div>
    );
  }

  if (!matchId || matchError || (!matchLoading && !match)) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Parier</h2>
        <p>Match introuvable.</p>
        <Link to="/" className="btn secondary">Retour à l&apos;accueil</Link>
      </div>
    );
  }

  if (matchLoading || !match) {
    return (
      <div className="card">
        <p>Chargement du match…</p>
      </div>
    );
  }

  if (match.status !== "upcoming") {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Parier</h2>
        <p>Les paris sont fermés pour ce match.</p>
        <Link to="/" className="btn secondary">Retour à l&apos;accueil</Link>
      </div>
    );
  }

  return (
    <div className="card paris-page-card">
      <div className="paris-page-header">
        <Link to="/" className="btn secondary paris-back-btn">← Retour à l&apos;accueil</Link>
        <h2 className="paris-page-title">Paris sportifs</h2>
      </div>

      <div className="paris-match-info">
        {match.title && <p className="paris-match-title">{match.title}</p>}
        <p className="paris-match-vs">
          <strong>ArcMonkey</strong> vs <strong>{match.opponent}</strong>
          <span className="paris-format">({match.format ?? "BO3"})</span>
        </p>
        <p className="paris-match-date">
          {new Date(match.scheduledAt).toLocaleString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <p className="paris-balance">
        Ton solde disponible : <strong>{availableBalance} $</strong>
        {pendingStakes > 0 && (
          <span className="paris-balance-pending"> ({pendingStakes} $ en paris en cours)</span>
        )}
      </p>

      {matchStarted && (
        <p className="paris-match-started">
          Les paris sont fermés (match déjà commencé).
        </p>
      )}

      {!matchStarted && (
      <div className="paris-sections">
        {/* Victoire / Défaite ArcMonkey */}
        <section className="paris-section card paris-section-card">
          <h3>Victoire / Défaite ArcMonkey</h3>
          <div className="paris-section-inner paris-section-flex">
            <div className="paris-choices-row">
              <button
                type="button"
                className={victoryOutcome === "win" ? "btn paris-choice-btn" : "btn secondary paris-choice-btn"}
                onClick={() => { trigger("nudge"); setVictoryOutcome("win"); }}
              >
                Victoire ArcMonkey
              </button>
              <button
                type="button"
                className={victoryOutcome === "loss" ? "btn paris-choice-btn" : "btn secondary paris-choice-btn"}
                onClick={() => { trigger("nudge"); setVictoryOutcome("loss"); }}
              >
                Défaite ArcMonkey
              </button>
            </div>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.victory} onChange={(v) => setAmount("victory", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !amounts.victory || !canAfford("victory")}
              onClick={() => { trigger("success"); handleBet("VICTORY", { outcome: victoryOutcome }, "victory"); }}
            >
              Parier
            </button>
          </div>
        </section>

        {/* Kills */}
        <section className="paris-section card paris-section-card">
          <h3>Nombre de kills (joueur ArcMonkey)</h3>
          <p className="paris-hint">Choisis un joueur et un seuil de kills sur l&apos;ensemble du BO.</p>
          <div className="paris-section-block">
            <div className="paris-form-group">
              <span className="paris-form-label">Joueur</span>
              <PlayerChoiceCards
                players={players}
                selectedId={killsPlayerId}
                onSelect={setKillsPlayerId}
                onHaptic={() => trigger("nudge")}
              />
            </div>
            <label className="paris-form-group paris-form-group-inline">
              <span className="paris-form-label">Seuil</span>
              <select
                className="paris-select input"
                value={killsThreshold}
                onChange={(e) => setKillsThreshold(e.target.value)}
              >
                {KILL_THRESHOLDS.map((t) => (
                  <option key={t} value={t}>{t} kills</option>
                ))}
              </select>
            </label>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.kills} onChange={(v) => setAmount("kills", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !killsPlayerId || !amounts.kills || !canAfford("kills")}
              onClick={() => { trigger("success"); handleBet("KILLS", { playerId: killsPlayerId, threshold: killsThreshold }, "kills"); }}
            >
              Parier
            </button>
          </div>
        </section>

        {/* ACE */}
        <section className="paris-section card paris-section-card">
          <h3>ACE (joueur ArcMonkey)</h3>
          <p className="paris-hint">Parie qu&apos;un joueur fera au moins un ACE pendant le match.</p>
          <div className="paris-section-block">
            <div className="paris-form-group">
              <span className="paris-form-label">Joueur</span>
              <PlayerChoiceCards players={players} selectedId={acePlayerId} onSelect={setAcePlayerId} onHaptic={() => trigger("nudge")} />
            </div>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.ace} onChange={(v) => setAmount("ace", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !acePlayerId || !amounts.ace || !canAfford("ace")}
              onClick={() => { trigger("success"); handleBet("ACE", { playerId: acePlayerId }, "ace"); }}
            >
              Parier (il fera un ACE)
            </button>
          </div>
        </section>

        {/* Quadruple kill */}
        <section className="paris-section card paris-section-card">
          <h3>Quadruple kill (joueur ArcMonkey)</h3>
          <p className="paris-hint">Parie qu&apos;un joueur fera au moins un quadruple kill (4 kills dans un round) sur l&apos;ensemble du BO.</p>
          <div className="paris-section-block">
            <div className="paris-form-group">
              <span className="paris-form-label">Joueur</span>
              <PlayerChoiceCards players={players} selectedId={quadKillPlayerId} onSelect={setQuadKillPlayerId} onHaptic={() => trigger("nudge")} />
            </div>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.quadKill} onChange={(v) => setAmount("quadKill", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !quadKillPlayerId || !amounts.quadKill || !canAfford("quadKill")}
              onClick={() => { trigger("success"); handleBet("QUAD_KILL", { playerId: quadKillPlayerId }, "quadKill"); }}
            >
              Parier (quadruple kill)
            </button>
          </div>
        </section>

        {/* Meilleur killer */}
        <section className="paris-section card paris-section-card">
          <h3>Meilleur killer (ArcMonkey)</h3>
          <p className="paris-hint">Parie sur le joueur ArcMonkey qui finira avec le plus de kills sur l&apos;ensemble du BO.</p>
          <div className="paris-section-block">
            <div className="paris-form-group">
              <span className="paris-form-label">Joueur</span>
              <PlayerChoiceCards players={players} selectedId={mostKillsPlayerId} onSelect={setMostKillsPlayerId} onHaptic={() => trigger("nudge")} />
            </div>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.mostKills} onChange={(v) => setAmount("mostKills", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !mostKillsPlayerId || !amounts.mostKills || !canAfford("mostKills")}
              onClick={() => { trigger("success"); handleBet("MOST_KILLS", { playerId: mostKillsPlayerId }, "mostKills"); }}
            >
              Parier (il fera le plus de kills)
            </button>
          </div>
        </section>

        {/* Score exact */}
        <section className="paris-section card paris-section-card">
          <h3>Score exact</h3>
          <p className="paris-hint">ArcMonkey – Adversaire (selon {match.format ?? "BO3"})</p>
          <div className="paris-section-block">
            <div className="paris-form-group">
              <span className="paris-form-label">Score</span>
              <div className="paris-score-buttons">
                {exactScoreOptions.map((opt) => (
                  <button
                    key={`${opt.arc}-${opt.opp}`}
                    type="button"
                    className={exactScore && exactScore.arc === opt.arc && exactScore.opp === opt.opp ? "btn paris-score-btn" : "btn secondary paris-score-btn"}
                    onClick={() => { trigger("nudge"); setExactScore(opt); }}
                  >
                    {opt.arc} – {opt.opp}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="paris-section-footer">
            <AmountInput value={amounts.exactScore} onChange={(v) => setAmount("exactScore", v)} disabled={createBet.isPending} />
            <button
              type="button"
              className="btn paris-submit-btn"
              disabled={createBet.isPending || !exactScore || !amounts.exactScore || !canAfford("exactScore")}
onClick={() => {
                trigger("success");
                exactScore &&
                  handleBet("EXACT_SCORE", {
                    scoreArcMonkey: exactScore.arc,
                    scoreOpponent: exactScore.opp,
                  }, "exactScore");
              }}
            >
              Parier
            </button>
          </div>
        </section>
      </div>
      )}

      {myBets.length > 0 && (
        <div className="paris-my-bets">
          <h3>Mes paris sur ce match</h3>
          <ul className="paris-my-bets-list">
            {myBets.map((b) => (
              <li key={b.id} className="paris-my-bet">
                <div className="paris-my-bet-main">
                  <div className="paris-my-bet-text">
                    <div className="paris-my-bet-amount">{b.amount} $</div>
                    <div className="paris-my-bet-label">{describeBetFr(b, players)}</div>
                  </div>
                  <div className="paris-my-bet-right">
                    <div className={`paris-my-bet-status paris-my-bet-status-${b.status.toLowerCase()}`}>
                      {b.status === "PENDING" && "En cours"}
                      {b.status === "WON" && "Gagné"}
                      {b.status === "LOST" && "Perdu"}
                      {b.status === "CANCELLED" && "Annulé"}
                      {!["PENDING", "WON", "LOST", "CANCELLED"].includes(b.status) && b.status}
                    </div>
                    {b.status === "PENDING" && !matchStarted && (
                      <button
                        type="button"
                        className="btn secondary paris-my-bet-cancel"
                        disabled={cancelBet.isPending}
onClick={() => {
                        trigger("nudge");
                        if (window.confirm("Annuler ce pari ?")) cancelBet.mutate(b.id);
                      }}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
                <div className="paris-my-bet-meta">
                  Placé le{" "}
                  {new Date(b.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
