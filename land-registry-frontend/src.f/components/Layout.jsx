import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Layout() {
  const { role, logout } = useAuth();

  return (
    <div>
      <nav>
        <h3>BBLRS</h3>

        <a href="/dashboard">Dashboard</a>
        <a href="/search">Search</a>

        {role === "ADMIN" && <a href="/admin/users">Users</a>}
        {role === "REGISTRAR" && <a href="/queue">Queue</a>}

        <button onClick={logout}>Logout</button>
      </nav>

      <Outlet />
    </div>
  );
}

export default Layout;