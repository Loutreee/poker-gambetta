import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { api, type User } from "../lib/api";

const ROLES: { value: string; label: string }[] = [
  { value: "player", label: "Joueur" },
  { value: "dealer", label: "Croupier" },
  { value: "admin", label: "Admin" },
];

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { trigger } = useWebHaptics();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const currentUser = me?.user ?? null;

  const { data: usersData } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.getAdminUsers(),
  });
  const users = usersData?.users ?? [];

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("player");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("player");
  const [editPassword, setEditPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.createUser({
        name: newName.trim(),
        role: newRole,
        password: newPassword,
      }),
    onSuccess: () => {
      toast.success("Utilisateur créé.");
      setNewName("");
      setNewRole("player");
      setNewPassword("");
      setNewPasswordConfirm("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: { name?: string; role?: string; password?: string } }) =>
      api.updateUser(params.id, params.data),
    onSuccess: () => {
      toast.success("Utilisateur mis à jour.");
      setEditingId(null);
      setEditPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (!currentUser) {
    return null;
  }
  if (currentUser.role !== "dealer" && currentUser.role !== "admin") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        Accès réservé aux croupiers et administrateurs.
      </div>
    );
  }

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Entre un nom.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    trigger("success");
    createMutation.mutate();
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPassword("");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const data: { name?: string; role?: string; password?: string } = {};
    if (editName.trim().length < 2) {
      toast.error("Le nom doit faire au moins 2 caractères.");
      return;
    }
    data.name = editName.trim();
    data.role = editRole;
    if (editPassword) {
      if (editPassword.length < 6) {
        toast.error("Le mot de passe doit faire au moins 6 caractères.");
        return;
      }
      data.password = editPassword;
    }
    trigger("success");
    updateMutation.mutate({ id: editingId, data });
  };

  return (
    <div className="grid grid-2">
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>Admin – Utilisateurs</h2>
          {currentUser.role === "admin" && (
            <Link
              to="/admin/badges"
              className="btn secondary"
              style={{ fontSize: "0.9rem" }}
              onClick={() => trigger("nudge")}
            >
              Voir les badges
            </Link>
          )}
        </div>
        <p style={{ marginTop: 4, color: "#444" }}>
          Crée de nouveaux comptes, ajuste les rôles (joueur, croupier, admin) et
          réinitialise les mots de passe si besoin.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Créer un utilisateur</h3>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Nom</label>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du joueur"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Rôle</label>
          <select
            className="select"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Mot de passe initial
          </label>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Au moins 6 caractères"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Confirmation du mot de passe
          </label>
          <input
            type="password"
            className="input"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="Répète le mot de passe"
          />
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <button
            type="button"
            className="btn"
            disabled={createMutation.isPending}
            onClick={handleCreate}
          >
            {createMutation.isPending ? "Création…" : "Créer l’utilisateur"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Liste des utilisateurs</h3>
        {users.length === 0 ? (
          <p style={{ color: "#666" }}>Aucun utilisateur pour l’instant.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {editingId === u.id ? (
                      <input
                        className="input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      u.name
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <select
                        className="select"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLES.find((r) => r.value === u.role)?.label ?? u.role
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <div className="row" style={{ gap: 8 }}>
                        <input
                          type="password"
                          className="input"
                          style={{ maxWidth: 160 }}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Nouveau mot de passe (optionnel)"
                        />
                        <button
                          type="button"
                          className="btn"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditPassword("");
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          trigger("nudge");
                          startEdit(u);
                        }}
                      >
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

