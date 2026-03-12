import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode;
  role?: "dealer";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });
  const user = data?.user ?? null;

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        Chargement…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
