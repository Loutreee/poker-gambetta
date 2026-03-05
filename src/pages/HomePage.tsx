import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { api } from "../lib/api";
import PlayerNameWithTooltip from "../components/PlayerNameWithTooltip";

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount} $`;
}

export default function HomePage() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;
  const isDealer = user?.role === "dealer";

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(),
    enabled: !!user,
  });

  const top3 = leaderboard.slice(0, 3);
  const [particlesReady, setParticlesReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      const { loadSlim } = await import("@tsparticles/slim");
      await loadSlim(engine);
    }).then(() => {
      setParticlesReady(true);
    });
  }, []);

  return (
    <div className="grid grid-2">
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ marginTop: 0 }}>Bienvenue sur Poker Gambetta</h2>
        <p style={{ marginTop: 8, color: "#444" }}>
          {user
            ? `Salut ${user.name} !`
            : "Salut !"}
          {" "}Ce site te permet de suivre les résultats des parties entre amis :
          classement général, sessions, et historique des ajustements.
        </p>
        {isDealer ? (
          <p style={{ marginTop: 8, color: "#444" }}>
            En tant que <strong>croupier</strong>, tu as accès à plusieurs onglets :
            <br />
            - <strong>Dashboard</strong> pour voir le classement global et l’historique des ajustements.
            <br />
            - <strong>Croupier</strong> pour ajouter ou corriger les entrées (gains/pertes) des joueurs.
            <br />
            - <strong>Session</strong> pour créer, gérer et clôturer les sessions de jeu.
            <br />
            - <strong>Paramètres</strong> pour changer ton mot de passe.
            <br />
            Tout est pensé pour que tu puisses gérer la bankroll du groupe facilement pendant la soirée.
          </p>
        ) : (
          <p style={{ marginTop: 8, color: "#444" }}>
            Utilise les onglets en haut pour accéder au{" "}
            <strong>Dashboard</strong>, consulter tes résultats et l’historique,
            ou ajuster quelques réglages comme ton mot de passe.
          </p>
        )}
      </div>

      <div className="card card-no-scroll-x card-home-top3">
        <h3 style={{ marginTop: 0 }}>Top 3 joueurs</h3>
        {top3.length === 0 ? (
          <p style={{ color: "#666" }}>Le classement se remplira dès les premières parties.</p>
        ) : (
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
              {top3.map((u, idx) => {
                const rank = idx + 1;
                const rowClasses =
                  [
                    rank === 1 ? "row-first" : "",
                    rank === 1 ? "row-rank-1" : "",
                    rank === 2 ? "row-rank-2" : "",
                    rank === 3 ? "row-rank-3" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined;

                const rankClassName =
                  rank === 1
                    ? "rank-pos-1 first-player-rank"
                    : rank === 2
                      ? "rank-pos-2"
                      : "rank-pos-3";

                return (
                  <tr key={u.id} className={rowClasses}>
                    <td className="col-rank-trend">
                      {rank === 1 && particlesReady && (
                        <div className="first-row-bg-wrapper" aria-hidden>
                          <Particles
                            id="home-top3-first-stars"
                            className="first-row-particles"
                            options={{
                              fullScreen: { enable: false },
                              background: { color: { value: "transparent" } },
                              detectRetina: true,
                              particles: {
                                number: { value: 48, density: { enable: false } },
                                color: { value: ["#ffd700", "#fff8dc", "#ffffff"] },
                                shape: { type: "star" },
                                opacity: {
                                  value: 0.6,
                                },
                                size: {
                                  value: { min: 1, max: 3 },
                                },
                                move: {
                                  enable: true,
                                  speed: 0.8,
                                  direction: "none",
                                  outModes: { default: "bounce" },
                                },
                              },
                              interactivity: {
                                events: {
                                  onHover: { enable: false, mode: [] },
                                  onClick: { enable: false, mode: [] },
                                },
                              },
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={rankClassName}>{rank}</span>
                    </td>
                    <td>
                      <PlayerNameWithTooltip
                        userId={u.id}
                        name={u.name}
                        avatarUrl={u.avatarUrl}
                        rank={rank}
                        balance={u.balance}
                        className={rank === 1 ? "first-player-name" : undefined}
                      >
                        <span className={rank === 1 ? "first-player-name" : undefined}>{u.name}</span>
                      </PlayerNameWithTooltip>
                      {rank === 1 && (
                        <span className="crown-icon" aria-hidden>
                          👑
                        </span>
                      )}
                      {u.role === "dealer" ? <span className="badge">croupier</span> : null}
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatAmount(u.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Prochaine session programmée</h3>
        <p style={{ color: "#999", fontSize: "0.9rem" }}>
          Placeholder pour l’instant — la programmation des sessions sera ajoutée plus tard.
        </p>
      </div>

      <QuotesSlider />
    </div>
  );
}

function QuotesSlider() {
  const QUOTES = [
    "« J'ai une vision long terme de jeu » - Eliott",
    "« Le démon de l'amour est vraiment le plus terrifiant » - Marvin",
    "« Incroyable, incroyable » - Marvin",
    "« On a quand même vachement besoin les uns des autres » - Hugo",
    "« Eh j'aimerais trop visiter la Chine » - Hugo",
    "« Le financement participatif c'est une trop belle manière de payer quelque chose » - Hugo",
    "« En vrai une fois, pour une boite où le projet me motive ça me plairait d'être manager » - Hugo",
    "« Jvais aller vivre en Auvergne un de ces quatre moi » - Hugo",
    "« Les bitmoji snap on les a bien intégré au final » - Hugo",
    "« D'où la polysémie du phobos… » - Hugo",
    "« Vous savez que si on prend nos 3 initiales les gars ça fait KEH ! » - Hugo",
    "« L'aura de Clémentine me rappelle quelque chose un peu de club pingouin » - Hugo",
    "« Des fois j'ai l'impression que t'es Azur et que je suis Asmar » - Hugo",
    "« Vivre ce n'est jamais arrêter de mourir » - Eliott",
    "« J'aime pas que le passé resurgisse » - Eliott",
    "« J'ai pas envie de connaître les émotions » - Eliott",
    "« En vrai ça a aucun sens de faire la guerre » - Marvin",
    "« La haine ça s'épuise, alors que l'amour c'est infini » - Marvin",
    "« Est-ce que t'as le droit de boire de l'eau pendant le Ramadan si t'es en danger de mort ? » - Marvin",
    "« En vrai quand t'y penses c'est un truc de fou que l'Empire Romain se soit effondré » - Marvin",
    "« Je suis humble face à la vie » - Lou",
    "« C'est à cause de propos comme ça qu'il veut pas qu'on sorte avec sa sœur » - Lou",
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIndex((prev) => {
        const n = QUOTES.length;
        if (n <= 1) return 0;
        let next = Math.floor(Math.random() * n);
        while (next === prev) next = Math.floor(Math.random() * n);
        return next;
      });
    }, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <h3 style={{ marginTop: 0 }}>Citations de joueurs</h3>
      <p style={{ marginTop: 4, marginBottom: 12, color: "#666", fontSize: "0.9rem" }}>
        Quelques unes des meilleures citations que nous avons eu la chance d'entendre au 39 cours Gambetta.
      </p>
      <div
        className="quote-slider-box"
        style={{
          padding: 16,
          borderRadius: 10,
          background: "#f6f7f9",
          border: "1px dashed #e0e1e6",
          minHeight: 72,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span key={quoteIndex} className="quote-slider-fade" style={{ fontSize: "0.98rem", color: "#333" }}>
          {QUOTES[quoteIndex]}
        </span>
      </div>
    </div>
  );
}

