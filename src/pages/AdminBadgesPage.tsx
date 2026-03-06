import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { BADGE_CATEGORY_IDS, getBadgeConfig } from "../lib/badges";
import { api } from "../lib/api";

type EditState = {
  badgeId: string;
  name: string;
  description: string;
  bgColor: string;
  iconColor: string;
};

export default function AdminBadgesPage() {
  const queryClient = useQueryClient();
  const { trigger } = useWebHaptics();
  const [editing, setEditing] = useState<EditState | null>(null);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const currentUser = me?.user ?? null;

  const { data: config = {}, isLoading: configLoading } = useQuery({
    queryKey: ["badges-config"],
    queryFn: () => api.getBadgesConfig(),
  });

  const updateBadgeMutation = useMutation({
    mutationFn: ({ badgeId, data }: { badgeId: string; data: EditState }) =>
      api.updateBadge(badgeId, { name: data.name, description: data.description, bgColor: data.bgColor, iconColor: data.iconColor }),
    onSuccess: () => {
      toast.success("Badge mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["badges-config"] });
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (badgeId: string) => {
    const base = getBadgeConfig(badgeId, config[badgeId]);
    if (!base) return;
    setEditing({
      badgeId,
      name: base.name,
      description: base.description,
      bgColor: base.bgColor,
      iconColor: base.iconColor,
    });
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    trigger("success");
    updateBadgeMutation.mutate({ badgeId: editing.badgeId, data: editing });
  };

  if (!currentUser) return null;
  if (currentUser.role !== "admin") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="admin-badges-page">
      <div className="card admin-badges-header">
        <div className="row" style={{ flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Référentiel des badges</h2>
            <p style={{ margin: "6px 0 0", color: "#444", fontSize: "0.95rem" }}>
              Modifie le titre, la description et les couleurs de chaque badge. Les changements s’affichent sur les profils et dans les tooltips.
            </p>
          </div>
          <Link to="/admin" className="btn secondary" onClick={() => trigger("nudge")}>
            ← Retour à l’admin
          </Link>
        </div>
      </div>

      {configLoading ? (
        <p style={{ color: "#666" }}>Chargement…</p>
      ) : (
        <div className="admin-badges-categories">
          {BADGE_CATEGORY_IDS.map((cat) => (
            <section key={cat.id} className="admin-badges-category" style={{ ["--cat-color" as string]: cat.color }}>
              <div className="admin-badges-category-head">
                <h3 className="admin-badges-category-title">{cat.title}</h3>
                {cat.note && (
                  <span className="admin-badges-category-note">{cat.note}</span>
                )}
              </div>
              <div className="admin-badges-grid admin-badges-grid--editable">
                {cat.badgeIds.map((badgeId) => {
                  const fullConfig = getBadgeConfig(badgeId, config[badgeId]);
                  if (!fullConfig) return null;
                  const { name, description, bgColor, iconColor, Icon } = fullConfig;
                  return (
                    <div key={badgeId} className="admin-badge-item admin-badge-item--editable">
                      <div
                        className="admin-badge-circle"
                        style={{
                          ["--badge-color" as string]: bgColor,
                          ["--badge-icon-color" as string]: iconColor,
                        }}
                      >
                        <Icon className="admin-badge-circle-icon" size={28} strokeWidth={2} aria-hidden />
                      </div>
                      <span className="admin-badge-title">{name}</span>
                      <button
                        type="button"
                        className="btn secondary admin-badge-edit-btn"
                        onClick={() => { trigger("nudge"); startEdit(badgeId); }}
                      >
                        Modifier
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <>
          <div className="admin-badge-modal-overlay" onClick={() => setEditing(null)} aria-hidden />
          <div className="card admin-badge-modal" role="dialog" aria-labelledby="edit-badge-title">
            <h3 id="edit-badge-title" style={{ marginTop: 0 }}>Modifier le badge</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="admin-badge-form-label">Titre</label>
                <input
                  type="text"
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing((s) => s ? { ...s, name: e.target.value } : null)}
                  placeholder="Nom du badge"
                />
              </div>
              <div>
                <label className="admin-badge-form-label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing((s) => s ? { ...s, description: e.target.value } : null)}
                  placeholder="Description (affichée au survol)"
                />
              </div>
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div>
                  <label className="admin-badge-form-label">Couleur du badge</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editing.bgColor}
                      onChange={(e) => setEditing((s) => s ? { ...s, bgColor: e.target.value } : null)}
                      style={{ width: 44, height: 44, padding: 0, border: "1px solid #ccc", borderRadius: 8, cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={editing.bgColor}
                      onChange={(e) => setEditing((s) => s ? { ...s, bgColor: e.target.value } : null)}
                      style={{ width: 100 }}
                    />
                  </div>
                </div>
                <div>
                  <label className="admin-badge-form-label">Couleur de l’icône</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={editing.iconColor}
                      onChange={(e) => setEditing((s) => s ? { ...s, iconColor: e.target.value } : null)}
                      style={{ width: 44, height: 44, padding: 0, border: "1px solid #ccc", borderRadius: 8, cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={editing.iconColor}
                      onChange={(e) => setEditing((s) => s ? { ...s, iconColor: e.target.value } : null)}
                      style={{ width: 100 }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSaveEdit}
                disabled={updateBadgeMutation.isPending}
              >
                {updateBadgeMutation.isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
