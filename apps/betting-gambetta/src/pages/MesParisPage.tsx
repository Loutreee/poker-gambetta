import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";
import { describeOutcomeFr } from "../lib/betDescriptions";

type BetItem = Awaited<ReturnType<typeof api.getMyBets>>["bets"][number];

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const c =
    status === "WON" ? "mes-paris-status-won" : status === "LOST" ? "mes-paris-status-lost" : "mes-paris-status-pending";
  const label = status === "WON" ? "Gagné" : status === "LOST" ? "Perdu" : "En cours";
  return <span className={`mes-paris-status ${c}`}>{label}</span>;
}

export default function MesParisPage() {
  const { trigger } = useWebHaptics();
  const { data, isLoading } = useQuery({
    queryKey: ["betting-me-bets"],
    queryFn: () => api.getMyBets(),
  });
  const bets: BetItem[] = data?.bets ?? [];

  if (isLoading) {
    return (
      <div className="card">
        <p>Chargement de tes paris…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Mes paris</h2>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Liste de tous tes paris (en cours et terminés) avec match, type, mise, statut et gains.
      </p>

      {bets.length === 0 ? (
        <p style={{ color: "#666" }}>Tu n&apos;as pas encore de paris.</p>
      ) : (
        <ul className="mes-paris-list">
          {bets.map((b) => (
            <li key={b.id} className="mes-paris-item card">
              <div className="mes-paris-header">
                <span className="mes-paris-match">
                  {b.match
                    ? `ArcMonkey vs ${b.match.opponent}${b.match.format ? ` (${b.match.format})` : ""}`
                    : "Match supprimé"}
                </span>
                <span className="mes-paris-date">{b.match ? formatDate(b.match.scheduledAt) : ""}</span>
              </div>
              <p className="mes-paris-desc">{describeOutcomeFr(b.betType, b.payload, [])}</p>
              <div className="mes-paris-meta">
                <span className="mes-paris-amount">Mise : {b.amount} $</span>
                <StatusBadge status={b.status} />
                {b.gain != null && (
                  <span className={b.gain >= 0 ? "mes-paris-gain-won" : "mes-paris-gain-lost"}>
                    {b.gain >= 0 ? `+${b.gain}` : b.gain} $
                  </span>
                )}
              </div>
              {b.match && b.status === "PENDING" && (
                <Link
                  to={`/paris/${b.matchId}`}
                  className="btn secondary mes-paris-link"
                  onClick={() => trigger("nudge")}
                >
                  Voir le match
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
