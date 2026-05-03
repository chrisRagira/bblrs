import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

import AppLayout    from "../components/layout/AppLayout";
import LandingPage  from "../pages/LandingPage";
import LoginPage    from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import SearchResults   from "../pages/SearchResults";
import ParcelDetail    from "../pages/ParcelDetail";
import Dashboard       from "../pages/Dashboard";
import TransferForm    from "../pages/TransferForm";
import LandTransfer   from "../pages/LandTransfer";
import RegistrarQueue  from "../pages/RegistrarQueue";
import RegisterParcel  from "../pages/RegisterParcel";
import EncumbranceManager from "../pages/EncumbranceManager";
import UploadDocument  from "../pages/UploadDocument";
import DocumentVerifier from "../pages/DocumentVerifier";
import AuditLog        from "../pages/AuditLog";
import AdminUsers      from "../pages/AdminUsers";
import NotFound        from "../pages/NotFound";
// 👇 Add these missing imports
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import ReportsDashboard from "../pages/ReportsDashboard";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public layout wrapper */}
          <Route element={<AppLayout />}>
            <Route path="/"        element={<LandingPage />} />
            <Route path="/login"   element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* 👇 Add these missing public routes */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/search"  element={<SearchResults />} />
            <Route path="/parcels/:id" element={<ParcelDetail />} />
            <Route path="/verify"  element={<DocumentVerifier />} />

            {/* ── Authenticated: any role ─────────────────────────── */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/transfers/new" element={
              <ProtectedRoute roles={["BUYER/SELLER","LEGAL"]}>
                <TransferForm />
              </ProtectedRoute>
            } />

            <Route path="/transfers/initiate" element={
              <ProtectedRoute roles={["BUYER/SELLER","LEGAL","REGISTRAR"]}>
                <LandTransfer />
              </ProtectedRoute>
            } />

            <Route path="/parcels/:id/upload" element={
              <ProtectedRoute roles={["REGISTRAR"]}>
                <UploadDocument />
              </ProtectedRoute>
            } />

            {/* ── Registrar ──────────────────────────────────────── */}
            <Route path="/registrar/queue" element={
              <ProtectedRoute roles={["REGISTRAR"]}>
                <RegistrarQueue />
              </ProtectedRoute>
            } />

            <Route path="/registrar/parcels/new" element={
              <ProtectedRoute roles={["REGISTRAR"]}>
                <RegisterParcel />
              </ProtectedRoute>
            } />

            <Route path="/registrar/encumbrances" element={
              <ProtectedRoute roles={["REGISTRAR","FINANCIAL"]}>
                <EncumbranceManager />
              </ProtectedRoute>
            } />

            {/* ── Admin ──────────────────────────────────────────── */}
            <Route path="/admin/users" element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminUsers />
              </ProtectedRoute>
            } />

            <Route path="/admin/audit" element={
              <ProtectedRoute roles={["ADMIN","REGISTRAR"]}>
                <AuditLog />
              </ProtectedRoute>
            } />

            {/* 👇 Add this missing admin route */}
            <Route path="/admin/reports" element={
              <ProtectedRoute roles={["ADMIN","REGISTRAR"]}>
                <ReportsDashboard />
              </ProtectedRoute>
            } />

            {/* ── Fallbacks ─────────────────────────────────────── */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*"    element={<Navigate to="/404" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}