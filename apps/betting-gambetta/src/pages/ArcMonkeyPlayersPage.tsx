import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ArcMonkeyPlayer } from "../lib/api";

export default function ArcMonkeyPlayersPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = me?.user ?? null;
  const isKillian = user?.name === "Killian";

  const { data: playersData, isLoading } = useQuery({
    queryKey: ["betting-players"],
    queryFn: () => api.getBettingPlayers(),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
    enabled: !!user && isKillian,
  });

  const [newName, setNewName] = useState("");
  const [newSteamUrl, setNewSteamUrl] = useState("");
  const [newSteamDisplayName, setNewSteamDisplayName] = useState("");
  const [newUserId, setNewUserId] = useState<string>("");

  const createPlayer = useMutation({
    mutationFn: (params: { name: string; steamProfileUrl: string; steamDisplayName?: string; userId?: string | null }) =>
      api.createBettingPlayer(params),
    onSuccess: () => {
      setNewName("");
      setNewSteamUrl("");
      setNewSteamDisplayName("");
      setNewUserId("");
      queryClient.invalidateQueries({ queryKey: ["betting-players"] });
    },
  });

  const updatePlayer = useMutation({
    mutationFn: (payload: {
      id: string;
      data: { name?: string; steamProfileUrl?: string; steamDisplayName?: string | null; userId?: string | null; active?: boolean };
    }) => api.updateBettingPlayer(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betting-players"] });
    },
  });

  const deletePlayer = useMutation({
    mutationFn: (id: string) => api.deleteBettingPlayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betting-players"] });
    },
  });

  if (!user) {
    return (
      <div className="card">
        <p>Connexion requise.</p>
      </div>
    );
  }

  if (!isKillian) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Équipe ArcMonkey</h2>
        <p>Cette page est réservée à Killian pour gérer la liste des joueurs ArcMonkey.</p>
      </div>
    );
  }

  const players: ArcMonkeyPlayer[] = playersData?.players ?? [];

  const handleToggleActive = (player: ArcMonkeyPlayer) => {
    updatePlayer.mutate({ id: player.id, data: { active: !player.active } });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSteamUrl.trim()) return;
    createPlayer.mutate({
      name: newName.trim(),
      steamProfileUrl: newSteamUrl.trim(),
      steamDisplayName: newSteamDisplayName.trim() || undefined,
      userId: newUserId || undefined,
    });
  };

  const handleDelete = (player: ArcMonkeyPlayer) => {
    if (!window.confirm(`Supprimer ${player.name} de l'équipe ArcMonkey ?`)) return;
    deletePlayer.mutate(player.id);
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Équipe ArcMonkey</h2>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Gère ici la liste des <strong>joueurs ArcMonkey</strong>. Pour chaque joueur, renseigne le{" "}
        <strong>lien Steam</strong> ; tu peux aussi associer un compte Gambetta pour afficher sa photo de profil dans la line-up.
      </p>

      <form onSubmit={handleCreate} className="next-match-form" style={{ marginBottom: 24 }}>
        <div className="form-field">
          <span>Nom / Pseudo (optionnel)</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sinon on déduit le pseudo depuis l’URL Steam"
          />
        </div>
        <div className="form-field">
          <span>Lien profil Steam <strong>(obligatoire)</strong></span>
          <input
            type="url"
            value={newSteamUrl}
            onChange={(e) => setNewSteamUrl(e.target.value)}
            placeholder="https://steamcommunity.com/id/pseudo ou .../profiles/76561198..."
            required
          />
        </div>
        <div className="form-field">
          <span>Nom actuel Steam (affiché dans la line-up)</span>
          <input
            type="text"
            value={newSteamDisplayName}
            onChange={(e) => setNewSteamDisplayName(e.target.value)}
            placeholder="Optionnel — sinon le pseudo ci-dessus est utilisé"
          />
        </div>
        <div className="form-field">
          <span>Compte Gambetta (pour la photo de profil)</span>
          <select
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
          >
            <option value="">Aucun</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn"
          disabled={createPlayer.isPending || !newSteamUrl.trim()}
        >
          {createPlayer.isPending ? "Ajout…" : "Ajouter le joueur"}
        </button>
        {createPlayer.isError && (
          <p className="form-error">{(createPlayer.error as Error).message}</p>
        )}
      </form>

      {isLoading ? (
        <p>Chargement des joueurs…</p>
      ) : players.length === 0 ? (
        <p>Aucun joueur configuré. Ajoute les joueurs ArcMonkey avec le formulaire ci-dessus.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Nom</th>
              <th>Nom Steam</th>
              <th>Lien Steam</th>
              <th>Compte Gambetta</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  {(p.avatarUrl ?? p.user?.avatarUrl) ? (
                    <img
                      src={p.avatarUrl ?? p.user?.avatarUrl ?? ""}
                      alt=""
                      className="arcmonkey-list-avatar"
                    />
                  ) : (
                    <div className="arcmonkey-list-avatar-placeholder">
                      {(p.steamDisplayName || p.name).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </td>
                <td>
                  <input
                    type="text"
                    defaultValue={p.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== p.name) updatePlayer.mutate({ id: p.id, data: { name: v } });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    defaultValue={p.steamDisplayName ?? ""}
                    placeholder={p.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (p.steamDisplayName ?? "")) updatePlayer.mutate({ id: p.id, data: { steamDisplayName: v || null } });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="url"
                    defaultValue={p.steamProfileUrl ?? ""}
                    placeholder="Lien Steam"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== (p.steamProfileUrl ?? "")) updatePlayer.mutate({ id: p.id, data: { steamProfileUrl: v } });
                    }}
                  />
                </td>
                <td>
                  <select
                    defaultValue={p.userId ?? ""}
                    onChange={(e) => updatePlayer.mutate({ id: p.id, data: { userId: e.target.value || null } })}
                  >
                    <option value="">Aucun</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.active ? "Actif" : "Inactif"}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-icon-danger"
                    onClick={() => handleDelete(p)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

