import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { api } from "../lib/api";

const MIN_PASSWORD_LENGTH = 6;

export default function SettingsPage() {
  const { trigger } = useWebHaptics();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Mot de passe modifié.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
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

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%" }}>
      <h2 style={{ marginTop: 0 }}>Paramètres</h2>

      <form onSubmit={handleSubmit}>
        <h3 style={{ marginBottom: 8, fontSize: "1rem" }}>Changer le mot de passe</h3>
        <p style={{ marginTop: 0, marginBottom: 12, color: "#444", fontSize: "0.9rem" }}>
          Entre ton mot de passe actuel puis le nouveau (au moins {MIN_PASSWORD_LENGTH} caractères).
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Mot de passe actuel
          </label>
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
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Nouveau mot de passe
          </label>
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
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
            Confirmer le nouveau mot de passe
          </label>
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
