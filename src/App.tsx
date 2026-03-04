import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeRedirect from "./components/HomeRedirect";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DealerPage from "./pages/DealerPage";
import SessionPage from "./pages/SessionPage";

export default function App() {
  return (
    <Layout>
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
