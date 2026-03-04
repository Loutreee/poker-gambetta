import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeRedirect from "./components/HomeRedirect";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DealerPage from "./pages/DealerPage";
import SessionPage from "./pages/SessionPage";

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
        <Route path="/" element={<HomeRedirect />} />
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
          path="/dealer"
          element={
            <ProtectedRoute role="dealer">
              <DealerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/session"
          element={
            <ProtectedRoute>
              <SessionPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
