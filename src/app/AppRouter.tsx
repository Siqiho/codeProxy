import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/modules/auth/AuthProvider";
import { ProtectedRoute } from "@/app/guards/ProtectedRoute";
import { DashboardLayout } from "@/modules/layout/DashboardLayout";
import { LoginPage } from "@/modules/login/LoginPage";
import { MonitorPage } from "@/modules/monitor/MonitorPage";
import { ThemeProvider } from "@/modules/ui/ThemeProvider";
import { ToastProvider } from "@/modules/ui/ToastProvider";

export function AppRouter() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <div className="font-sans antialiased">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/monitor" element={<MonitorPage />} />
                  <Route path="/" element={<Navigate to="/monitor" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/monitor" replace />} />
            </Routes>
          </div>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
