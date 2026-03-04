import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";

export default function Layout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { trigger } = useWebHaptics();
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
        <nav className="layout-nav">
          <Link to="/" className="layout-logo" onClick={() => trigger("nudge")}>Poker Gambetta</Link>
          {user && (
            <>
              <Link to="/dashboard" onClick={() => trigger("nudge")}>Dashboard</Link>
              {user.role === "dealer" && <Link to="/dealer" onClick={() => trigger("nudge")}>Croupier</Link>}
              <Link to="/session" onClick={() => trigger("nudge")}>Session</Link>
              <Link to="/settings" onClick={() => trigger("nudge")}>Paramètres</Link>
            </>
          )}
        </nav>
        <div className="layout-actions">
          {user ? (
            <>
              <span className="badge layout-badge">
                {user.name} ({user.role === "dealer" ? "croupier" : "joueur"})
              </span>
              <button
                type="button"
                className="btn secondary"
                onClick={() => { trigger("success"); handleLogout(); }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link className="btn" to="/login" onClick={() => trigger("success")}>Connexion</Link>
          )}
        </div>
      </header>

      <main className="layout-main">{children}</main>
    </div>
  );
}
