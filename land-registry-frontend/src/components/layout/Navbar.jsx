import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../api/services";
import { C } from "../../styles/tokens";

const NAV_LINKS = [
  { label: "Search",          to: "/search",                  roles: null },
  { label: "Verify",          to: "/verify",                  roles: null },
  { label: "Dashboard",       to: "/dashboard",               roles: ["BUYER/SELLER","REGISTRAR","ADMIN","LEGAL","FINANCE",'CLERK','VALUER','LAND_CONTROL_BOARD','SURVEYOR','ADVOCATE','COUNTY_OFFICER'] },
  { label: "Initiate Transfer", to: "/transfers/new",         roles: ["BUYER/SELLER","LEGAL",] },
  { label: "Approval Queue",  to: "/registrar/queue",         roles: ["REGISTRAR"] },
  { label: "Register Parcel", to: "/registrar/parcels/new",   roles: ["REGISTRAR",'CLERK'] },
  { label: "Encumbrances",    to: "/registrar/encumbrances",  roles: ["REGISTRAR","FINANCE"] },
  { label: "Users",           to: "/admin/users",             roles: ["ADMIN"] },
  { label: "Audit Log",       to: "/admin/audit",             roles: ["ADMIN","REGISTRAR"] },
];

export default function Navbar() {
  const { isAuthenticated, user, role, logout } = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();

  const visibleLinks = NAV_LINKS.filter(
    (l) => !l.roles || (isAuthenticated && l.roles.includes(role))
  );

  const handleLogout = async () => {
    try { await authApi.logout(); } catch (_) { /* ignore */ }
    logout();
    navigate("/");
  };

  const initials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "?";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: C.navy, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px",
        display: "flex", alignItems: "center", height: 60,
      }}>

        {/* Brand */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, background: C.teal, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontSize: 16 }}>🏛</span>
          </div>
          <div>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>
              BBLRS Kenya
            </p>
            <p style={{ color: "#64748B", fontSize: 10, letterSpacing: "0.06em" }}>
              BLOCKCHAIN LAND REGISTRY
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <div style={{ flex: 1, display: "flex", gap: 2, marginLeft: 28, flexWrap: "nowrap", overflow: "hidden" }}>
          {visibleLinks.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link key={l.to} to={l.to} style={{
                background: active ? C.teal : "none",
                color: active ? "#fff" : "#94A3B8",
                padding: "6px 13px", borderRadius: 6, fontSize: 13,
                fontWeight: 500, whiteSpace: "nowrap", textDecoration: "none",
                transition: "all 0.15s",
              }}>
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Auth controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {!isAuthenticated ? (
            <>
              <Link to="/login" style={{ color: "#94A3B8", fontSize: 13 }}>Sign In</Link>
              <Link to="/register" style={{
                background: C.teal, color: "#fff",
                padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: 500,
              }}>Register</Link>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", background: C.teal,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, color: "#fff",
              }}>
                {initials}
              </div>
              <div>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{`${user?.first_name} ${user?.last_name}` || "User"}</p>
                <p style={{ color: "#64748B", fontSize: 11 }}>{role}</p>
              </div>
              <button onClick={handleLogout} style={{
                background: "none", border: "none", color: "#64748B",
                fontSize: 13, cursor: "pointer", marginLeft: 4,
              }}>
                Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}
