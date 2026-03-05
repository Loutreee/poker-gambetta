import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";

const MIN_PASSWORD_LENGTH = 6;
const MAX_AVATAR_SIZE_MB = 20;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { trigger } = useWebHaptics();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const me = meData?.user ?? null;
  const { data: profileData } = useQuery({
    queryKey: ["profile", me?.id],
    queryFn: () => api.getProfile(me!.id),
    enabled: !!me?.id,
  });
  const profile = profileData?.user;

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setBio(profile.bio ?? "");
    }
  }, [profile?.id, profile?.name, profile?.bio]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { name?: string; bio?: string | null }) => api.updateMyProfile(data),
    onSuccess: (data) => {
      toast.success("Profil mis à jour.");
      queryClient.setQueryData(["profile", me?.id], { user: data.user, balance: profileData?.balance ?? 0 });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (imageDataUrl: string) => api.uploadAvatar(imageDataUrl),
    onSuccess: (data) => {
      toast.success("Photo de profil enregistrée.");
      queryClient.setQueryData(["profile", me?.id], (prev: { user: typeof data.user; balance?: number } | undefined) =>
        prev ? { ...prev, user: data.user } : undefined,
      );
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Mot de passe modifié.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    trigger("success");
    updateProfileMutation.mutate({ name: name.trim() || undefined, bio: bio.trim() || null });
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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error("Entre ton mot de passe actuel.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    trigger("success");
    changePasswordMutation.mutate();
  };

  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <div style={{ display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className="card" style={{ maxWidth: 640, width: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Paramètres</h2>

        {/* Profil */}
        <form onSubmit={handleProfileSubmit} style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12, fontSize: "1rem" }}>Profil</h3>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div className="profile-avatar-wrap">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="profile-avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div
                  className="profile-avatar profile-avatar-placeholder"
                  style={{ width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#e0e1e6", fontSize: "2rem" }}
                  aria-hidden
                >
                  {profile?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
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
                style={{ fontSize: "0.9rem" }}
                onClick={() => { trigger("nudge"); avatarInputRef.current?.click(); }}
                disabled={uploadAvatarMutation.isPending}
              >
                {uploadAvatarMutation.isPending ? "Envoi…" : "Changer la photo"}
              </button>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#666" }}>
                JPEG, PNG, WebP ou GIF — max {MAX_AVATAR_SIZE_MB} Mo
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Nom</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ton prénom ou pseudo"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Description (bio)</label>
            <textarea
              className="input"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Quelques mots sur toi…"
            />
          </div>

          <button
            type="submit"
            className="btn"
            onClick={() => trigger("success")}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? "Enregistrement…" : "Enregistrer le profil"}
          </button>
        </form>

        <hr style={{ border: "none", borderTop: "1px solid #e0e1e6", margin: "24px 0" }} />

        {/* Mot de passe */}
        <form onSubmit={handlePasswordSubmit}>
          <h3 style={{ marginBottom: 8, fontSize: "1rem" }}>Changer le mot de passe</h3>
          <p style={{ marginTop: 0, marginBottom: 12, color: "#444", fontSize: "0.9rem" }}>
            Entre ton mot de passe actuel puis le nouveau (au moins {MIN_PASSWORD_LENGTH} caractères).
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Mot de passe actuel</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Nouveau mot de passe</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Au moins ${MIN_PASSWORD_LENGTH} caractères`}
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn"
            onClick={() => trigger("success")}
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? "Enregistrement…" : "Changer le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}
