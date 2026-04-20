import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { parcelsApi, transfersApi , registrarApi, notificationsApi } from "../api/services";
import { PageHeader, StatCard, Card } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { Spinner } from "../components/ui/Feedback";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const DEMO_PARCELS = [
  { parcelID: "a1b2", titleNumber: "KE/NKR/2024/0042", county: "Nakuru",  areaHectares: 0.25, landUseType: "RESIDENTIAL", status: "ACTIVE"     },
  { parcelID: "b2c3", titleNumber: "KE/NAI/2020/0117", county: "Nairobi", areaHectares: 0.08, landUseType: "COMMERCIAL",  status: "ENCUMBERED" },
];

const DEMO_NOTIFICATIONS = [
  { type: "success", msg: "Transfer request TC-0042 has been approved by the Registrar.", time: "2 hours ago" },
  { type: "warn",    msg: "Your mortgage on KE/NAI/2020/0117 expires in 30 days.",        time: "Yesterday"   },
  { type: "info",    msg: "System maintenance scheduled for Sunday 02:00–04:00 EAT.",     time: "3 days ago"  },
];

const NOTIF_ACCENT = { success: C.success, warn: C.gold, info: C.teal, danger: C.danger };

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [parcels,  setParcels]  = useState([]);
  const [pending,  setPending]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
  if (!user) return; // ✅ prevent undefined calls

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, tuRes, tRes] = await Promise.all([
        parcelsApi.getByOwner(user?.id),
        transfersApi.getByOwner(),
        role === "REGISTRAR"
          ? registrarApi.getPending()
          : Promise.resolve({ data: { data: [] } })
      ]);
      const userTransfers = tuRes.data.data || [];
      const registrarTransfers = tRes.data.data || [];

      // 🔥 Merge + remove duplicates
      const combined = [
        ...new Map(
          [...userTransfers, ...registrarTransfers]
            .map(t => [t.transfer_id, t])
        ).values()
      ];

      setPending(combined || []);
      setParcels(pRes.data.data || []);

       try {
          const res = await notificationsApi.getByUser(user?.id);
          setNotifications(res.data.data);
        } catch (err) {
          console.error("Notifications error", err);
          setNotifications([]); 
        }

    } catch (err) {
      console.error("🔥 DASHBOARD ERROR:", err);
      setParcels([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  load();
}, [user, role]);

function getAge(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}



  const activeParcels    = parcels.filter(p => p.status === "ACTIVE");
  const encumberedParcels = parcels.filter(p => p.status === "ENCUMBERED");
  console.log(parcels)

  return (
    <div className="page-wrapper">
      <PageHeader
        title={`Welcome, ${user?.fullName?.split(" ")[0] || "User"}`}
        subtitle={`${role} · Your land portfolio on the blockchain`}
        action={
          role === "LANDOWNER" || role === "LEGAL"
            ? <Button onClick={() => navigate("/transfers/new")}>+ Initiate Transfer</Button>
            : role === "REGISTRAR"
            ? <Button onClick={() => navigate("/registrar/queue")}>View Approval Queue</Button>
            : role === "ADMIN"
            ? <Button onClick={() => navigate("/admin/users")}>Manage Users</Button>
            : null
        }
      />

      {loading ? <Spinner /> : (
        <>
          {/* ── Stats ──────────────────────────────────────────── */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            <StatCard label="Total Parcels"     value={parcels.length}          icon="🏘" />
            <StatCard label="Active"            value={activeParcels.length}    icon="✓" />
            <StatCard label="Encumbered"        value={encumberedParcels.length} icon="🔒" />
            <StatCard label="Pending Transfers" value={pending.length}          icon="🔄" accent />
          </div>

          {/* ── Main content ───────────────────────────────────── */}
          <div className="grid-content">

            {/* Left: parcels */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>My Parcels</h2>
                <Link to="/search" style={{ fontSize: 13, color: C.teal }}>Browse all →</Link>
              </div>

              {parcels.length === 0 ? (
                <Card>
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.textSecondary }}>
                    <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>🏘</span>
                    <p>No parcels registered to your account yet.</p>
                  </div>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {parcels.map((p) => (
                    <Card key={p.parcelID} style={{ cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <span className="monospace">{p.titleNumber}</span>
                            <Badge status={p.status} />
                          </div>
                          <p style={{ fontSize: 13, color: C.textSecondary }}>
                            📍 {p.county} · 📐 {p.areaHectares} ha · {p.landUseType}
                          </p>
                        </div>
                        <Link to={`/parcels/${p.parcelID}`} className="btn btn--secondary btn--sm">
                          View →
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Pending transfers */}
              {pending.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginTop: 28 }}>Pending Transfers</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pending.map((t) => (
                      <Card key={t.transfer_id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span className="monospace">Transfer #{t.transfer_id}</span>
                            <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 3 }}>
                             Parcel #{t.parcel_id} · {t.title_number} · {t.transfer_type} FROM {t.prev_owner_name} TO {t.new_owner_name}
                            </p>
                          </div>
                          <Badge status="PENDING" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Registrar-specific quick links */}
              {role === "REGISTRAR" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
                  {[
                    { label: "Approval Queue",   to: "/registrar/queue",         icon: "📋" },
                    { label: "Register Parcel",  to: "/registrar/parcels/new",   icon: "➕" },
                    { label: "Encumbrances",     to: "/registrar/encumbrances",  icon: "🔒" },
                    { label: "Audit Log",        to: "/admin/audit",             icon: "📊" },
                  ].map(({ label, to, icon }) => (
                    <Link key={to} to={to} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "#fff", border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: "14px 16px",
                      color: C.textPrimary, fontSize: 14, fontWeight: 500,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right: notifications */}
            <div>
              <h2 className="section-title">Notifications</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {notifications.map((n) => (
                    <div onClick={async () => {
                        await notificationsApi.markRead(n.id);

                        setNotifications((prev) =>
                          prev.map((x) =>
                            x.id === n.id ? { ...x, is_read: true } : x
                          )
                        );
                      }}
                      key={n.id}
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${NOTIF_ACCENT[n.type]}`,
                        borderRadius: 8,
                        padding: "12px 14px",
                        opacity: n.is_read ? 0.6 : 1
                      }}
                    >
                      <p style={{ fontSize: 13 }}>{n.message}</p>
                      <p style={{ fontSize: 11, color: C.textSecondary }}>
                        {getAge(n.created_at)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
