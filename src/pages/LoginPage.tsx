import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });
  const [selectedId, setSelectedId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (users.length > 0 && !selectedId) setSelectedId(users[0].id);
  }, [users, selectedId]);

  const loginMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      api.login(userId, password),
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], { user: data.user });
      navigate("/dashboard");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = () => {
    setError("");
    if (!selectedId || !password) {
      setError("Choisis un compte et entre ton mot de passe.");
      return;
    }
    loginMutation.mutate({ userId: selectedId, password });
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Connexion</h2>
      <p style={{ marginTop: 4, color: "#444" }}>
        Choisis ton compte et entre ton mot de passe.
      </p>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
          Compte
        </label>
        <select
          className="select"
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setError(""); }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.role === "dealer" ? "(croupier)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
          Mot de passe
        </label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Mot de passe"
        />
      </div>

      {(error || loginMutation.isError) && (
        <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>
          {error || (loginMutation.error as Error)?.message}
        </div>
      )}

      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Connexion…" : "Se connecter"}
        </button>
      </div>
    </div>
  );
}
