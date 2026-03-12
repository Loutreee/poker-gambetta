import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function HomeRedirect() {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        Chargement…
      </div>
    );
  }

  return <Navigate to={data?.user ? "/dashboard" : "/login"} replace />;
}
