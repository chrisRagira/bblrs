import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";

// Pages
import LandingPage from "../pages/LandingPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import Dashboard from "../pages/Dashboard";
import AdminUsers from "../pages/AdminUsers";
import ParcelDetail from "../pages/ParcelDetail";
import TransferForm from "../pages/TransferForm";
import UploadDocument from "../pages/UploadDocument";
import RegistrarQueue from "../pages/RegistrarQueue";
import SearchResults from "../pages/SearchResults";
import ForgotPassword from "../src/pages/ForgotPassword";
import ResetPassword from "../src/pages/ResetPassword";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Layout */}
        <Route element={<Layout />}>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/parcel/:id"
            element={
              <ProtectedRoute>
                <ParcelDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/transfer"
            element={
              <ProtectedRoute roles={["BUYER/SELLER"]}>
                <TransferForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <UploadDocument />
              </ProtectedRoute>
            }
          />

          <Route
            path="/queue"
            element={
              <ProtectedRoute roles={["REGISTRAR"]}>
                <RegistrarQueue />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/reports" element={
            <ProtectedRoute roles={["ADMIN","REGISTRAR"]}>
              <ReportsDashboard />
            </ProtectedRoute>
          } />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;