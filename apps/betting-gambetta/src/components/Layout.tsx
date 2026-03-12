import type { ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";

export default function Layout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { trigger } = useWebHaptics();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const user = data?.user ?? null;

  const handleLogout = async () => {
    await api.logout();
    queryClient.setQueryData(["me"], { user: null });
    navigate("/login");
  };

  return (
    <div className="container layout-container">
      <header className="layout-header">
        <Link to="/" className="layout-logo" onClick={() => trigger("nudge")}>Betting Gambetta</Link>

        {user && (
          <Link
            to={`/profile/${user.id}`}
            className="badge layout-badge"
            onClick={() => trigger("nudge")}
          >
            {user.name} ({user.role === "dealer" ? "croupier" : "joueur"})
          </Link>
        )}

        <button
          type="button"
          className="layout-burger"
          aria-label="Ouvrir le menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => { trigger("nudge"); setMobileMenuOpen((o) => !o); }}
        >
          <span className="layout-burger-line" />
          <span className="layout-burger-line" />
          <span className="layout-burger-line" />
        </button>

        <nav className="layout-nav layout-nav-desktop" aria-label="Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
            onClick={() => trigger("nudge")}
          >
            Accueil
          </NavLink>
          <a
            href={import.meta.env.VITE_POKER_APP_URL ?? "http://localhost:5173"}
            target="_blank"
            rel="noopener noreferrer"
            className="layout-nav-link layout-nav-link-poker"
            onClick={() => trigger("nudge")}
          >
            Poker
          </a>
          {user && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                }
                onClick={() => trigger("nudge")}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/mes-paris"
                className={({ isActive }) =>
                  `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                }
                onClick={() => trigger("nudge")}
              >
                Mes paris
              </NavLink>
              {user.name === "Killian" && (
                <>
                  <NavLink
                    to="/matches"
                    className={({ isActive }) =>
                      `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                    }
                    onClick={() => trigger("nudge")}
                  >
                    Matchs
                  </NavLink>
                  <NavLink
                    to="/arcmonkey"
                    className={({ isActive }) =>
                      `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                    }
                    onClick={() => trigger("nudge")}
                  >
                    Équipe ArcMonkey
                  </NavLink>
                  <NavLink
                    to="/paris-admin"
                    className={({ isActive }) =>
                      `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                    }
                    onClick={() => trigger("nudge")}
                  >
                    Admin paris
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>

        {mobileMenuOpen && (
          <>
            <div className="layout-nav-mobile-overlay" aria-hidden onClick={() => setMobileMenuOpen(false)} />
            <nav className="layout-nav-mobile" aria-label="Navigation">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Accueil
              </NavLink>
              <a
                href={import.meta.env.VITE_POKER_APP_URL ?? "http://localhost:5173"}
                target="_blank"
                rel="noopener noreferrer"
                className="layout-nav-link layout-nav-link-poker"
                onClick={() => setMobileMenuOpen(false)}
              >
                Poker
              </a>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/mes-paris"
                className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Mes paris
              </NavLink>
              {user?.name === "Killian" && (
                <>
                  <NavLink
                    to="/matches"
                    className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Matchs
                  </NavLink>
                  <NavLink
                    to="/arcmonkey"
                    className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Équipe ArcMonkey
                  </NavLink>
                  <NavLink
                    to="/paris-admin"
                    className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin paris
                  </NavLink>
                </>
              )}
              {user && (
                <button
                  type="button"
                  className="btn secondary layout-nav-mobile-logout"
                  onClick={() => { trigger("success"); setMobileMenuOpen(false); handleLogout(); }}
                >
                  Déconnexion
                </button>
              )}
            </nav>
          </>
        )}

        <div className="layout-actions">
          {user ? (
            <button
              type="button"
              className="btn secondary layout-actions-logout"
              onClick={() => { trigger("success"); handleLogout(); }}
            >
              Déconnexion
            </button>
          ) : (
            <Link className="btn" to="/login" onClick={() => trigger("success")}>Connexion</Link>
          )}
        </div>
      </header>

      <main className="layout-main">{children}</main>
    </div>
  );
}
