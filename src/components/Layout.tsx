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
        <Link to="/" className="layout-logo" onClick={() => trigger("nudge")}>Poker Gambetta</Link>

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
          <NavLink to="/" end className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => trigger("nudge")}>Accueil</NavLink>
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
              {user.role === "dealer" && (
                <NavLink
                  to="/dealer"
                  className={({ isActive }) =>
                    `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                  }
                  onClick={() => trigger("nudge")}
                >
                  Croupier
                </NavLink>
              )}
              <NavLink
                to="/session"
                className={({ isActive }) =>
                  `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                }
                onClick={() => trigger("nudge")}
              >
                Session
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                }
                onClick={() => trigger("nudge")}
              >
                Paramètres
              </NavLink>
              <NavLink
                to="/poker-hands"
                className={({ isActive }) =>
                  `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                }
                onClick={() => trigger("nudge")}
              >
                Mains
              </NavLink>
              {(user.role === "dealer" || user.role === "admin") && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`
                  }
                  onClick={() => trigger("nudge")}
                >
                  Admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        {mobileMenuOpen && (
          <>
            <div className="layout-nav-mobile-overlay" aria-hidden onClick={() => setMobileMenuOpen(false)} />
            <nav className="layout-nav-mobile" aria-label="Navigation">
              <NavLink to="/" end className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Accueil</NavLink>
              <NavLink to="/dashboard" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Classement</NavLink>
              {user?.role === "dealer" && <NavLink to="/dealer" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Croupier</NavLink>}
              <NavLink to="/session" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Session</NavLink>
              <NavLink to="/poker-hands" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Mains</NavLink>
              <NavLink to="/settings" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Paramètres</NavLink>
              {(user?.role === "dealer" || user?.role === "admin") && <NavLink to="/admin" className={({ isActive }) => `layout-nav-link${isActive ? " layout-nav-link-active" : ""}`} onClick={() => setMobileMenuOpen(false)}>Admin</NavLink>}
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
