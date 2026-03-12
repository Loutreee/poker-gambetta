import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import MatchPage from "./pages/MatchPage";
import ArcMonkeyPlayersPage from "./pages/ArcMonkeyPlayersPage";
import ParisPage from "./pages/ParisPage";
import ParisAdminPage from "./pages/ParisAdminPage";
import MesParisPage from "./pages/MesParisPage";

const TOAST_POSITION_DESKTOP = "bottom-right";
const TOAST_POSITION_MOBILE = "bottom-center";
const TOAST_BREAKPOINT = 768;

export default function App() {
  const [toastPosition, setToastPosition] = useState<"bottom-right" | "bottom-center">(
    () => (typeof window !== "undefined" && window.innerWidth > TOAST_BREAKPOINT ? TOAST_POSITION_DESKTOP : TOAST_POSITION_MOBILE),
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${TOAST_BREAKPOINT + 1}px)`);
    const update = () => setToastPosition(mq.matches ? TOAST_POSITION_DESKTOP : TOAST_POSITION_MOBILE);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Layout>
      <Toaster
        position={toastPosition}
        expand={false}
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            maxWidth: "min(100vw - 24px, 360px)",
            marginBottom: "env(safe-area-inset-bottom, 8px)",
          },
        }}
      />
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mes-paris"
          element={
            <ProtectedRoute>
              <MesParisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <MatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/arcmonkey"
          element={
            <ProtectedRoute>
              <ArcMonkeyPlayersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paris/:matchId"
          element={
            <ProtectedRoute>
              <ParisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/paris-admin"
          element={
            <ProtectedRoute>
              <ParisAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
