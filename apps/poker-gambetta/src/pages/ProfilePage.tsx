import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";
import BadgeDisplay from "../components/BadgeDisplay";

const MAX_AVATAR_SIZE_MB = 20;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const { trigger } = useWebHaptics();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const currentUser = me?.user ?? null;

  const { data: profileData, isError: profileError } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => api.getProfile(userId!),
    enabled: !!userId,
  });
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => api.getLeaderboard(),
    enabled: !!currentUser,
  });
  const { data: historyData } = useQuery({
    queryKey: ["balance-history", userId],
    queryFn: () => api.getBalanceHistory(userId!),
    enabled: !!userId,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { bio?: string | null }) => api.updateMyProfile(data),
    onSuccess: (data) => {
      toast.success("Profil mis à jour.");
      queryClient.setQueryData(["profile", userId], (prev: { user: unknown; balance?: number; badges?: unknown[] } | undefined) =>
        prev ? { ...prev, user: data.user } : { user: data.user },
      );
      setEditingBio(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (imageDataUrl: string) => api.uploadAvatar(imageDataUrl),
    onSuccess: (data) => {
      toast.success("Photo de profil enregistrée.");
      queryClient.setQueryData(["profile", userId], (prev: { user: typeof data.user; balance?: number; badges?: unknown[] } | undefined) =>
        prev ? { ...prev, user: data.user } : undefined,
      );
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const profile = profileData?.user;
  const rank = leaderboard.findIndex((u) => u.id === userId) + 1;
  const points = historyData?.points ?? [];
  const isOwnProfile = currentUser?.id === userId;

  const ath = useMemo(() => {
    const values = [profileData?.balance ?? 0, ...points.map((p) => p.balance)];
    return Math.max(0, ...values);
  }, [profileData?.balance, points]);

  const chartData = points.map((p) => ({
    ...p,
    balance: Number(p.balance),
    label: formatDate(p.date),
    fullDate: p.date,
  }));

  if (!userId) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        Profil non spécifié.
      </div>
    );
  }
  if (profileError) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        Utilisateur introuvable.
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        Chargement…
      </div>
    );
  }

  const startEditBio = () => {
    setBioDraft(profile.bio ?? "");
    setEditingBio(true);
  };

  const saveBio = () => {
    trigger("success");
    updateProfileMutation.mutate({ bio: bioDraft.trim() || null });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisis une image (JPEG, PNG, WebP ou GIF).");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      toast.error(`Image trop lourde (max ${MAX_AVATAR_SIZE_MB} Mo).`);
      return;
    }
    trigger("success");
    try {
      const dataUrl = await fileToDataUrl(file);
      uploadAvatarMutation.mutate(dataUrl);
    } catch {
      toast.error("Impossible de lire le fichier.");
    }
    e.target.value = "";
  };

  return (
    <div className="profile-page">
      <div className="card" style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginBottom: 24 }}>
          <div className="profile-avatar-wrap">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar profile-avatar-placeholder" aria-hidden>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwnProfile && (
              <div style={{ marginTop: 8 }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  style={{ display: "none" }}
                  aria-label="Choisir une photo"
                />
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: "0.85rem" }}
                  onClick={() => { trigger("nudge"); avatarInputRef.current?.click(); }}
                  disabled={uploadAvatarMutation.isPending}
                >
                  {uploadAvatarMutation.isPending ? "Envoi…" : "Changer la photo"}
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
              {rank > 0 ? (
                <>
                  <span className={rank <= 3 ? `rank-pos-${rank}` : undefined} style={rank <= 3 ? { fontWeight: 700 } : undefined}>
                    #{rank}
                  </span>
                  {" au classement général"}
                </>
              ) : (
                "Pas encore classé"
              )}
            </p>
            <h1 style={{ marginTop: 4, marginBottom: 4 }}>
              {profile.name}
            </h1>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#333" }}>
              Solde actuel : {profileData?.balance ?? 0} $
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "#666" }}>
              ATH (record) : {ath} $
            </p>
            {profile.role !== "player" && (
              <span className="badge" style={{ marginTop: 4 }}>
                {profile.role === "dealer" ? "Croupier" : "Admin"}
              </span>
            )}
          </div>
        </div>

        <div className="card profile-badges-card">
          <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: "0.95rem" }}>Badges (haut faits)</h3>
          <div className="profile-badges-list">
            {(profileData?.badges ?? []).length === 0 ? (
              <span style={{ fontSize: "0.85rem", color: "#666", fontStyle: "italic" }}>Aucun badge pour l’instant.</span>
            ) : (
              (profileData?.badges ?? []).map((b) => (
                <BadgeDisplay key={b.badgeId} badge={b} size="normal" showCount />
              ))
            )}
          </div>
        </div>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Description</h3>
          {isOwnProfile && !editingBio && (
            <button
              type="button"
              className="btn secondary"
              style={{ marginBottom: 8 }}
              onClick={() => { trigger("nudge"); startEditBio(); }}
            >
              Modifier
            </button>
          )}
          {editingBio ? (
            <div>
              <textarea
                className="input"
                rows={4}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="Présente-toi en quelques mots…"
              />
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button type="button" className="btn" onClick={saveBio} disabled={updateProfileMutation.isPending}>
                  Enregistrer
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditingBio(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#333", whiteSpace: "pre-wrap" }}>
              {profile.bio?.trim() || "Aucune description pour l’instant."}
            </p>
          )}
        </section>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, textAlign: "center" }}>
            Évolution de la banque
          </h3>
          <p style={{ marginTop: -8, marginBottom: 16, textAlign: "center", color: "#666", fontSize: "0.9rem" }}>
            Un point par session à laquelle le joueur a participé.
          </p>
          {chartData.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#666", background: "#f6f7f9", borderRadius: 10 }}>
              Aucune session enregistrée pour l’instant.
            </div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(v) => `${v} $`}
                  />
                  <Tooltip
                    shared={false}
                    content={({ active, payload, label, activeIndex }) => {
                      if (!active || !payload?.length) return null;
                      const index =
                        typeof activeIndex === "number"
                          ? activeIndex
                          : typeof activeIndex === "string"
                            ? parseInt(activeIndex, 10)
                            : NaN;
                      const chartPoint = !Number.isNaN(index)
                        ? chartData[index]
                        : chartData.find((d) => d.label === label);
                      const balance = chartPoint
                        ? chartPoint.balance
                        : Number(payload[0]?.payload?.balance ?? payload[0]?.value ?? 0);
                      const dateStr = chartPoint?.fullDate
                        ? formatDate(chartPoint.fullDate)
                        : (label ?? "");
                      return (
                        <div
                          className="card"
                          style={{ padding: "8px 12px", margin: 0, minWidth: 120 }}
                        >
                          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                            {dateStr}
                          </div>
                          <div style={{ fontWeight: 600 }}>Solde : {balance} $</div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#111"
                    strokeWidth={2}
                    dot={{ fill: "#111", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
