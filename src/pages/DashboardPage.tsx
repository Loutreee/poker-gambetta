import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function BalanceTrend({ delta }: { delta: number }) {
  if (delta === 0) return null;
  if (delta > 0)
    return (
      <span className="balance-trend balance-trend-up" title="Solde en hausse sur la dernière semaine" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12 L12 4 M12 4 L12 8 M12 4 L8 4" />
        </svg>
      </span>
    );
  return (
    <span className="balance-trend balance-trend-down" title="Solde en baisse sur la dernière semaine" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4 L4 12 M4 12 L4 8 M4 12 L8 12" />
      </svg>
    </span>
  );
}

function RankTrend({ change }: { change: number }) {
  if (change === 0) return null;
  if (change < 0)
    return <span className="rank-trend rank-trend-up" title="A gagné des places cette semaine">+{Math.abs(change)}</span>;
  return <span className="rank-trend rank-trend-down" title="A perdu des places cette semaine">−{change}</span>;
}

export default function DashboardPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const user = me?.user ?? null;
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(),
    enabled: !!user,
  });
  const { data: myEntries = [] } = useQuery({
    queryKey: ["ledger", "me"],
    queryFn: () => api.getMyEntries(),
    enabled: !!user,
  });
  const { data: latestGlobal = [] } = useQuery({
    queryKey: ["ledger", "latest"],
    queryFn: () => api.getLedger(),
    enabled: !!user,
  });

  const userIdToName = Object.fromEntries(
    leaderboard.map((u) => [u.id, u.name])
  );

  if (!user) return null;

  return (
    <div className="grid grid-2">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Classement</h2>
        <table className="table">
          <thead>
            <tr>
              <th className="col-rank-trend"></th>
              <th>#</th>
              <th>Joueur</th>
              <th>Solde</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u, idx) => (
              <tr key={u.id} className={u.id === user.id ? "row-current-user" : undefined}>
                <td className="col-rank-trend">
                  <RankTrend change={u.rankChange ?? 0} />
                </td>
                <td>{idx + 1}</td>
                <td>
                  {u.name}
                  {u.role === "dealer" ? <span className="badge">croupier</span> : null}
                </td>
                <td style={{ fontWeight: 800 }}>
                  {u.balance}
                  <BalanceTrend delta={u.balanceDeltaWeek ?? 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Ton historique</h2>
        {myEntries.length === 0 ? (
          <p style={{ color: "#444" }}>Aucune entrée pour l'instant.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Delta</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {myEntries.slice(0, 12).map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.createdAt)}</td>
                  <td style={{ fontWeight: 800 }}>{formatAmount(e.amount)}</td>
                  <td>{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, borderTop: "1px solid #eef0f4", paddingTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Dernières modifs (global)</h3>
          {latestGlobal.length === 0 ? (
            <p style={{ color: "#444" }}>Rien à afficher.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Joueur</th>
                  <th>Delta</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {latestGlobal.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.createdAt)}</td>
                    <td>{userIdToName[e.userId] ?? e.userId}</td>
                    <td style={{ fontWeight: 800 }}>{formatAmount(e.amount)}</td>
                    <td>{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
