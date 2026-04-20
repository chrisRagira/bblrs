import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SearchResults from "./pages/SearchResults";
import ParcelDetail from "./pages/ParcelDetail";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import TransferForm from "./pages/TransferForm";
import RegistrarQueue from "./pages/RegistrarQueue";
import AdminUsers from "./pages/AdminUsers";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/parcels/:id" element={<ParcelDetail />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        }/>

        <Route path="/transfers/new" element={
          <ProtectedRoute><TransferForm /></ProtectedRoute>
        }/>

        <Route path="/registrar" element={
          <ProtectedRoute><RegistrarQueue /></ProtectedRoute>
        }/>

        <Route path="/admin/users" element={
          <ProtectedRoute><AdminUsers /></ProtectedRoute>
        }/>
      </Routes>
    </>
  );
}

export default App;