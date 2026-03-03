import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function Layout({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const user = data?.user ?? null;

  const handleLogout = async () => {
    await api.logout();
    queryClient.setQueryData(["me"], { user: null });
    navigate("/login");
  };

  return (
    <div className="container">
      <div className="row space-between" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16 }}>
          <Link to="/" style={{ fontWeight: 800 }}>Poker Gambetta</Link>
          {user && (
            <>
              <Link to="/dashboard">Dashboard</Link>
              {user.role === "dealer" && <Link to="/dealer">Croupier</Link>}
            </>
          )}
        </div>

        <div className="row" style={{ gap: 10 }}>
          {user ? (
            <>
              <div className="badge">
                {user.name} ({user.role === "dealer" ? "croupier" : "joueur"})
              </div>
              <button
                className="btn secondary"
                onClick={handleLogout}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link className="btn" to="/login">Connexion</Link>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
