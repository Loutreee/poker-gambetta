import { Link } from "react-router-dom";

type Props = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  rank?: number;
  balance?: number;
  className?: string;
  children?: React.ReactNode;
};

export default function PlayerNameWithTooltip({
  userId,
  name,
  avatarUrl,
  rank,
  balance,
  className,
  children,
}: Props) {
  const display = children ?? name;
  return (
    <span className={`player-name-tooltip ${className ?? ""}`.trim()}>
      <span className="player-name-tooltip-trigger">{display}</span>
      <span className="player-name-tooltip-content" role="tooltip">
        <span className="player-name-tooltip-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="player-name-tooltip-initial">{name.charAt(0).toUpperCase()}</span>
          )}
        </span>
        <span className="player-name-tooltip-body">
          <span className="player-name-tooltip-name">{name}</span>
          {rank != null && (
            <span className="player-name-tooltip-meta">
              #{rank}
              {balance != null && ` · ${balance} $`}
            </span>
          )}
          <span className="player-name-tooltip-badges" aria-hidden>
            <span className="player-name-tooltip-badges-placeholder">Badges à venir</span>
          </span>
          <Link to={`/profile/${userId}`}>Voir le profil</Link>
        </span>
      </span>
    </span>
  );
}
