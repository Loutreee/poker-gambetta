import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWebHaptics } from "web-haptics/react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { api } from "../lib/api";
import { getMatchCalendarUrl } from "../lib/calendar";
import PlayerNameWithTooltip from "../components/PlayerNameWithTooltip";

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount} $`;
}

export default function HomePage() {
  const { trigger } = useWebHaptics();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(),
    enabled: !!user,
  });

  const { data: nextMatchData } = useQuery({
    queryKey: ["next-match"],
    queryFn: () => api.getNextMatch(),
    enabled: !!user,
    // On refait régulièrement un ping pour que le passage en LIVE
    // (et le changement de bouton PARIER -> Voir mes paris) se fasse sans refresh manuel.
    refetchInterval: 15000,
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

  const nextMatch = nextMatchData?.match ?? null;

  return (
    <div className="grid grid-2">
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ marginTop: 0 }}>Bienvenue sur Betting Gambetta</h2>
        <p style={{ marginTop: 8, color: "#444" }}>
          {user ? `Salut ${user.name} !` : "Salut !"}{" "}
          Ici, tu peux suivre et préparer les <strong>matchs CS d&apos;ArcMonkey</strong> et
          placer des paris amicaux entre joueurs Gambetta.
        </p>
        <p style={{ marginTop: 8, color: "#444" }}>
          Ce site est séparé de <strong>Poker Gambetta</strong> pour garder ton expérience poker propre,
          mais tu utilises <strong>le même compte</strong> et le même classement.
        </p>
      </div>

      <div className="card card-no-scroll-x card-home-top3">
        <h3 style={{ marginTop: 0 }}>Top 3 bankrolls</h3>
        {top3.length === 0 ? (
          <p style={{ color: "#666" }}>Le classement se remplira dès les premiers mouvements de bankroll.</p>
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
                                color: { value: ["#a78bfa", "#c4b5fd", "#ddd6fe", "#ffffff"] },
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
                        badges={u.badges ?? []}
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

      <div className="card card-next-match">
        <div className="next-match-header">
          <span className="next-match-label">Prochain match</span>
          {nextMatch ? (
            <>
              {nextMatch.title && (
                <p className="next-match-title">{nextMatch.title}</p>
              )}
              {nextMatch.isLive && (
                <a
                  href="https://www.twitch.tv/loutreee_cs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="next-match-live"
                  aria-label="Voir le direct sur Twitch"
                  title="Voir le direct sur Twitch"
                >
                  LIVE
                </a>
              )}
              <h3 className="next-match-vs">
                <span className="next-match-team next-match-team-arc">ArcMonkey</span>
                <span className="next-match-vs-sep">vs</span>
                <span className="next-match-team next-match-team-opp">{nextMatch.opponent}</span>
              </h3>
              <p className="next-match-meta">
                <span className="next-match-format">{nextMatch.format ?? "BO3"}</span>
                <span className="next-match-date">
                  {new Date(nextMatch.scheduledAt).toLocaleString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <a
                href={getMatchCalendarUrl(nextMatch)}
                download="match-arcmonkey.ics"
                className="next-match-calendar-link"
                onClick={() => trigger("nudge")}
              >
                Ajouter au calendrier
              </a>
            </>
          ) : (
            <p className="next-match-empty">
              Aucun match programmé
            </p>
          )}
        </div>
        {nextMatch && nextMatch.players.length > 0 && (
          <div className="next-match-lineup">
            <span className="next-match-lineup-title">Line-up</span>
            <ul className="next-match-players">
              {nextMatch.players.map((p) => {
                const content = (
                  <>
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl.startsWith("http") ? p.avatarUrl : p.avatarUrl}
                        alt=""
                        className="next-match-player-avatar"
                      />
                    ) : (
                      <span className="next-match-player-avatar-placeholder">
                        {(p.steamDisplayName || p.name).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="next-match-player-name">{p.steamDisplayName || p.name}</span>
                  </>
                );
                return (
                  <li key={p.id} className="next-match-player">
                    {p.steamProfileUrl ? (
                      <a
                        href={p.steamProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="next-match-player-link"
                        title="Profil Steam"
                      >
                        {content}
                      </a>
                    ) : (
                      <span className="next-match-player-link">{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {nextMatch && (
          <Link
            to={`/paris/${nextMatch.id}`}
            className={nextMatch.isLive ? "next-match-parier-btn next-match-voir-paris-btn" : "next-match-parier-btn"}
            onClick={() => trigger("nudge")}
          >
            {nextMatch.isLive ? "Voir mes paris" : "PARIER"}
          </Link>
        )}
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
    "« Bro is not fooling anyone » - Thomas",
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
          background: "var(--violet-50)",
          border: "1px dashed var(--violet-200)",
          minHeight: 72,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span key={quoteIndex} className="quote-slider-fade" style={{ fontSize: "0.98rem", color: "var(--violet-text)" }}>
          {QUOTES[quoteIndex]}
        </span>
      </div>
    </div>
  );
}

