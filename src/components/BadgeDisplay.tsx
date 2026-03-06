import { useQuery } from "@tanstack/react-query";
import { getBadgeConfig } from "../lib/badges";
import { api } from "../lib/api";
import type { UserBadge } from "../lib/api";

type Props = {
  badge: UserBadge;
  size?: "normal" | "small";
  showCount?: boolean;
};

export default function BadgeDisplay({ badge, size = "normal", showCount = true }: Props) {
  const { data: badgesConfig } = useQuery({
    queryKey: ["badges-config"],
    queryFn: () => api.getBadgesConfig(),
  });
  const config = getBadgeConfig(badge.badgeId, badgesConfig?.[badge.badgeId]);
  if (!config) return null;

  const { name, description, bgColor, iconColor, Icon } = config;
  const count = badge.count;
  const isSmall = size === "small";

  return (
    <div
      className={`profile-badge ${isSmall ? "profile-badge--small" : ""}`}
      style={
        {
          ["--badge-bg" as string]: bgColor,
          ["--badge-icon-color" as string]: iconColor,
        } as React.CSSProperties
      }
    >
      <div className="profile-badge-circle">
        <Icon
          className="profile-badge-circle-icon"
          size={isSmall ? 16 : 28}
          strokeWidth={2}
          aria-hidden
        />
        <span className="profile-badge-tooltip" role="tooltip">
          <strong>{name}{showCount && count > 1 ? ` ×${count}` : ""}</strong>
          {description && (
            <>
              <br />
              <span className="profile-badge-tooltip-desc">{description}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
