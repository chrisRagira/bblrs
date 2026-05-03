import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  parcelsApi,
  transfersApi,
  registrarApi,
  notificationsApi,
} from "../api/services";
import { PageHeader, StatCard, Card } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { Spinner } from "../components/ui/Feedback";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

// ─── Workflow step config ────────────────────────────────────────────────────
const TRANSFER_STEPS = [
  { key: "CREATED",           label: "Initiated",           icon: "📝", actor: "Advocate"       },
  { key: "SELLER_CONFIRMED",  label: "Seller Confirmed",    icon: "✅", actor: "Seller"          },
  { key: "DOCUMENTS_VERIFIED",label: "Docs Verified",       icon: "🔍", actor: "Registry Clerk"  },
  { key: "SURVEY_VERIFIED",   label: "Survey Verified",     icon: "📐", actor: "Surveyor"        },
  { key: "LCB_APPROVED",      label: "LCB Approved",        icon: "🏛️", actor: "LCB Officer"    },
  { key: "RATES_CLEARED",     label: "Rates Cleared",       icon: "🏢", actor: "County Officer"  },
  { key: "VALUED",            label: "Valued",              icon: "💰", actor: "Gov. Valuer"     },
  { key: "STAMP_DUTY_PAID",   label: "Stamp Duty Paid",     icon: "🧾", actor: "Buyer / KRA"    },
  { key: "APPROVED",          label: "Registrar Approved",  icon: "🏛", actor: "Registrar"       },
  { key: "COMPLETED",         label: "Title Issued",        icon: "🎉", actor: "System"          },
];

const STATUS_STEP_INDEX = Object.fromEntries(
  TRANSFER_STEPS.map((s, i) => [s.key, i])
);

// ─── Role → dashboard config ─────────────────────────────────────────────────
const ROLE_CONFIG = {
  ADVOCATE: {
    label: "Advocate",
    icon: "⚖️",
    accent: C.teal,
    primaryAction: { label: "+ New Transaction",  path: "/transfers/new" },
    quickLinks: [
      { label: "My Transactions",  path: "/transfers",           icon: "📋" },
      { label: "Upload Documents", path: "/transfers/documents", icon: "📄" },
      { label: "Track Progress",   path: "/transfers/track",     icon: "🔄" },
    ],
  },
  BUYER_SELLER: {
    label: "Buyer / Seller",
    icon: "🏠",
    accent: "#6366f1",
    primaryAction: { label: "Pending Transactions", path: "/transfers/pending" },
    quickLinks: [
      { label: "My transfers",    path: "/transfers",    icon: "🔔" },
      { label: "My Parcels",       path: "/parcels",              icon: "🏘" },
      { label: "Pay Stamp Duty",   path: "/transfers/stamp-duty", icon: "💳" },
      { label: "Download Title",   path: "/titles",               icon: "📜" },
    ],
  },
  CLERK: {
    label: "Registry Clerk",
    icon: "🗂️",
    accent: "#d97706",
    primaryAction: { label: "Verification Queue", path: "/clerk/queue" },
    quickLinks: [
      { label: "Pending Verification", path: "/clerk/queue",    icon: "📋" },
      { label: "Approved",             path: "/clerk/approved", icon: "✅" },
      { label: "Rejected",             path: "/clerk/rejected", icon: "❌" },
    ],
  },
  SURVEYOR: {
    label: "Surveyor",
    icon: "📐",
    accent: "#7c3aed",
    primaryAction: { label: "My Assigned Parcels", path: "/surveyor/assignments" },
    quickLinks: [
      { label: "Upload Survey Map",    path: "/surveyor/upload",       icon: "🗺️" },
      { label: "Assigned Parcels",     path: "/surveyor/assignments",  icon: "📋" },
      { label: "Completed Surveys",    path: "/surveyor/completed",    icon: "✅" },
    ],
  },
  LCB_OFFICER: {
    label: "LCB Officer",
    icon: "🏛️",
    accent: "#b45309",
    primaryAction: { label: "Consent Queue", path: "/lcb/queue" },
    quickLinks: [
      { label: "Consent Requests", path: "/lcb/queue",    icon: "📋" },
      { label: "Approved",         path: "/lcb/approved", icon: "✅" },
    ],
  },
  COUNTY_OFFICER: {
    label: "County Officer",
    icon: "🏢",
    accent: "#0e7490",
    primaryAction: { label: "Clearance Queue", path: "/county/queue" },
    quickLinks: [
      { label: "Clearance Requests", path: "/county/queue",    icon: "📋" },
      { label: "Land Rates History", path: "/county/rates",    icon: "📊" },
    ],
  },
  VALUER: {
    label: "Gov. Valuer",
    icon: "💰",
    accent: "#15803d",
    primaryAction: { label: "Valuation Queue", path: "/valuer/queue" },
    quickLinks: [
      { label: "Pending Valuations",   path: "/valuer/queue",     icon: "📋" },
      { label: "Completed Valuations", path: "/valuer/completed", icon: "✅" },
    ],
  },
  REGISTRAR: {
    label: "Registrar",
    icon: "🏛",
    accent: C.teal,
    primaryAction: { label: "Approval Queue", path: "/registrar/queue" },
    quickLinks: [
      { label: "Approval Queue",   path: "/registrar/queue",       icon: "📋" },
      { label: "Register Parcel",  path: "/registrar/parcels/new", icon: "➕" },
      { label: "Reports",          path: "/admin/reports",         icon: "📊" },
      { label: "Audit Log",        path: "/admin/audit",           icon: "🔎" },
    ],
  },
  ADMIN: {
    label: "Admin",
    icon: "⚙️",
    accent: "#6b7280",
    primaryAction: { label: "Manage Users", path: "/admin/users" },
    quickLinks: [
      { label: "Users",   path: "/admin/users",   icon: "👥" },
      { label: "Reports", path: "/admin/reports", icon: "📊" },
      { label: "Audit",   path: "/admin/audit",   icon: "🔎" },
    ],
  },
};

// ─── Role → stats config ─────────────────────────────────────────────────────
function getRoleStats(role, parcels, pending) {
  const active     = parcels.filter(p => p.status === "ACTIVE").length;
  const encumbered = parcels.filter(p => p.status === "ENCUMBERED").length;

  const byStatus = (s) => pending.filter(t => t.status === s).length;

  const maps = {
    ADVOCATE: [
      { label: "My Transactions",  value: pending.length,          icon: "📋" },
      { label: "Awaiting Seller",  value: byStatus("CREATED"),     icon: "⏳" },
      { label: "In Progress",      value: byStatus("DOCUMENTS_VERIFIED") + byStatus("SURVEY_VERIFIED"), icon: "🔄", accent: true },
      { label: "Completed",        value: byStatus("COMPLETED"),   icon: "🎉" },
    ],
    BUYER_SELLER: [
      { label: "My Parcels",       value: parcels.length,         icon: "🏘" },
      { label: "Pending Transactions",    value: byStatus("CREATED"),    icon: "🔔", accent: true },
      { label: "Awaiting Payment", value: byStatus("VALUED"),     icon: "💳" },
      { label: "Completed",        value: byStatus("COMPLETED"),  icon: "🎉" },
    ],
    CLERK: [
      { label: "Pending Verification", value: byStatus("SELLER_CONFIRMED"), icon: "📋", accent: true },
      { label: "Verified Today",       value: byStatus("DOCUMENTS_VERIFIED"), icon: "✅" },
      { label: "Rejected",             value: 0,                             icon: "❌" },
      { label: "Total Processed",      value: pending.length,                icon: "📊" },
    ],
    SURVEYOR: [
      { label: "Assigned",      value: byStatus("DOCUMENTS_VERIFIED"), icon: "📋", accent: true },
      { label: "Completed",     value: byStatus("SURVEY_VERIFIED"),    icon: "✅" },
      { label: "Total Parcels", value: parcels.length,                 icon: "🏘" },
      { label: "Pending Upload",value: byStatus("DOCUMENTS_VERIFIED"), icon: "📐" },
    ],
    LCB_OFFICER: [
      { label: "Consent Requests", value: byStatus("SURVEY_VERIFIED"), icon: "📋", accent: true },
      { label: "Approved",         value: byStatus("LCB_APPROVED"),    icon: "✅" },
      { label: "Total Reviewed",   value: pending.length,              icon: "📊" },
      { label: "Pending",          value: byStatus("SURVEY_VERIFIED"), icon: "⏳" },
    ],
    COUNTY_OFFICER: [
      { label: "Clearance Requests", value: byStatus("LCB_APPROVED"),   icon: "📋", accent: true },
      { label: "Cleared",            value: byStatus("RATES_CLEARED"),  icon: "✅" },
      { label: "Total Processed",    value: pending.length,             icon: "📊" },
      { label: "Pending",            value: byStatus("LCB_APPROVED"),   icon: "⏳" },
    ],
    VALUER: [
      { label: "Pending Valuation", value: byStatus("RATES_CLEARED"), icon: "💰", accent: true },
      { label: "Valued",            value: byStatus("VALUED"),        icon: "✅" },
      { label: "Total Processed",   value: pending.length,            icon: "📊" },
      { label: "Pending",           value: byStatus("RATES_CLEARED"), icon: "⏳" },
    ],
    REGISTRAR: [
      { label: "My Parcels",          value: parcels.length,              icon: "🏘" },
      { label: "Pending Approval",    value: byStatus("STAMP_DUTY_PAID"), icon: "📋", accent: true },
      { label: "Approved Today",      value: byStatus("APPROVED"),        icon: "✅" },
      { label: "Completed",           value: byStatus("COMPLETED"),       icon: "🎉" },
    ],
    ADMIN: [
      { label: "Total Parcels",    value: parcels.length,  icon: "🏘" },
      { label: "Transfers",        value: pending.length,  icon: "🔄" },
      { label: "Active",           value: active,          icon: "✅" },
      { label: "Encumbered",       value: encumbered,      icon: "🔒" },
    ],
  };

  return maps[role] || maps.BUYER_SELLER;
}

// ─── Status step progress bar ────────────────────────────────────────────────
function TransferProgress({ status }) {
  const currentIdx = STATUS_STEP_INDEX[status] ?? -1;
  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        minWidth: 520,
      }}>
        {TRANSFER_STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const current = i === currentIdx;
          const future  = i > currentIdx;
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < TRANSFER_STEPS.length - 1 ? 1 : "none" }}>
              <div title={`${step.label} (${step.actor})`} style={{
                width: 26, height: 26, borderRadius: "50%",
                background: done ? C.teal : current ? C.gold : "#e5e7eb",
                border: current ? `2px solid ${C.gold}` : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: done || current ? "#fff" : "#9ca3af",
                flexShrink: 0,
                boxShadow: current ? `0 0 0 3px ${C.gold}33` : "none",
                transition: "all 0.2s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              {i < TRANSFER_STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2,
                  background: done ? C.teal : "#e5e7eb",
                  transition: "background 0.3s",
                }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, minWidth: 520 }}>
        {TRANSFER_STEPS.map((step, i) => {
          const current = i === currentIdx;
          return (
            <div key={step.key} style={{
              fontSize: 9, color: current ? C.teal : "#9ca3af",
              fontWeight: current ? 700 : 400,
              width: 50, textAlign: "center", flexShrink: 0,
            }}>
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Role-specific action panel ──────────────────────────────────────────────
function RoleActionPanel({ role, transfer, onAction }) {
  const status = transfer?.status;

  // Map: which role acts at which status, what CTA to show
  const panels = {
    BUYER_SELLER: {
      triggerStatus: "CREATED",
      cta: "Confirm Sale",
      path: `/transfers/${transfer?.transfer_id}/seller-confirm`,
      color: "#6366f1",
      desc: "Review and confirm you agree to this sale.",
    },
    CLERK: {
      triggerStatus: "SELLER_CONFIRMED",
      cta: "Start Verification",
      path: `/clerk/queue/${transfer?.transfer_id}`,
      color: "#d97706",
      desc: "Review documents and IDs for this transfer.",
    },
    SURVEYOR: {
      triggerStatus: "DOCUMENTS_VERIFIED",
      cta: "Upload Survey",
      path: `/surveyor/assignments/${transfer?.transfer_id}`,
      color: "#7c3aed",
      desc: "Upload survey map and beacon confirmation for this parcel.",
    },
    LCB_OFFICER: {
      triggerStatus: "SURVEY_VERIFIED",
      cta: "Review Consent",
      path: `/lcb/queue/${transfer?.transfer_id}`,
      color: "#b45309",
      desc: "Approve or reject the Land Control Board consent.",
    },
    COUNTY_OFFICER: {
      triggerStatus: "LCB_APPROVED",
      cta: "Approve Clearance",
      path: `/county/queue/${transfer?.transfer_id}`,
      color: "#0e7490",
      desc: "Confirm no outstanding land rates on this parcel.",
    },
    VALUER: {
      triggerStatus: "RATES_CLEARED",
      cta: "Submit Valuation",
      path: `/valuer/queue/${transfer?.transfer_id}`,
      color: "#15803d",
      desc: "Input the land value for stamp duty calculation.",
    },
    REGISTRAR: {
      triggerStatus: "STAMP_DUTY_PAID",
      cta: "Final Approval",
      path: `/registrar/queue/${transfer?.transfer_id}`,
      color: C.teal,
      desc: "Review all steps and approve or reject. Issue title upon approval.",
    },
  };

  const panel = panels[role];
  if (!panel || !transfer) return null;
  if (status !== panel.triggerStatus) return null;

  return (
    <div style={{
      background: `${panel.color}12`,
      border: `1.5px solid ${panel.color}40`,
      borderRadius: 10,
      padding: "14px 16px",
      marginTop: 12,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: panel.color, marginBottom: 3 }}>
          Action Required
        </p>
        <p style={{ fontSize: 12, color: C.textSecondary }}>{panel.desc}</p>
      </div>
      <Link
        to={panel.path}
        style={{
          background: panel.color,
          color: "#fff",
          padding: "8px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        {panel.cta} →
      </Link>
    </div>
  );
}

// ─── Notification helpers ────────────────────────────────────────────────────
const NOTIF_ACCENT = {
  success: C.success,
  warn: C.gold,
  info: C.teal,
  danger: C.danger,
};

function getAge(timestamp) {
  const diffMs  = Date.now() - new Date(timestamp);
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [parcels,       setParcels]       = useState([]);
  const [pending,       setPending]       = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.BUYER_SELLER;

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [pRes, tuRes, tRes] = await Promise.all([
          parcelsApi.getByOwner(user?.id),
          transfersApi.getByOwner(),
          role === "REGISTRAR"
            ? registrarApi.getPending()
            : Promise.resolve({ data: { data: [] } }),
        ]);

        const userTransfers      = tuRes.data.data || [];
        const registrarTransfers = tRes.data.data  || [];

        const combined = [
          ...new Map(
            [...userTransfers, ...registrarTransfers].map(t => [t.transfer_id, t])
          ).values(),
        ];

        setPending(combined);
        setParcels(pRes.data.data || []);

        try {
          const nRes = await notificationsApi.getByUser(user?.id);
          setNotifications(nRes.data.data || []);
        } catch {
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

  const stats = getRoleStats(role, parcels, pending);

  // ─── Transfers that need THIS role's action ──────────────────────────────
  const ACTION_STATUS = {
    BUYER_SELLER:  "CREATED",
    CLERK:         "SELLER_CONFIRMED",
    SURVEYOR:      "DOCUMENTS_VERIFIED",
    LCB_OFFICER:   "SURVEY_VERIFIED",
    COUNTY_OFFICER:"LCB_APPROVED",
    VALUER:        "RATES_CLEARED",
    REGISTRAR:     "STAMP_DUTY_PAID",
  };

  const myActionStatus   = ACTION_STATUS[role];
  const actionableItems  = myActionStatus
    ? pending.filter(t => t.status === myActionStatus)
    : [];

  return (
    <div className="page-wrapper">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Welcome, ${user?.first_name || "User"}`}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              background: `${cfg.accent}18`,
              color: cfg.accent,
              padding: "2px 10px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${cfg.accent}30`,
            }}>
              {cfg.icon} {cfg.label}
            </span>
            <span style={{ color: C.textSecondary, fontSize: 13 }}>
              · Land Registry Blockchain System
            </span>
          </span>
        }
        action={
          cfg.primaryAction
            ? <Button onClick={() => navigate(cfg.primaryAction.path)}>
                {cfg.primaryAction.label}
              </Button>
            : null
        }
      />

      {loading ? <Spinner /> : (
        <>
          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
            ))}
          </div>

          {/* ── Action alert (for roles with queued items) ──────────────────── */}
          {actionableItems.length > 0 && (
            <div style={{
              background: `${cfg.accent}0e`,
              border: `1.5px solid ${cfg.accent}35`,
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: cfg.accent }}>
                  {cfg.icon} {actionableItems.length} item{actionableItems.length > 1 ? "s" : ""} awaiting your action
                </p>
                <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  These transfers are in your court — review and act to keep the process moving.
                </p>
              </div>
              <Link
                to={cfg.primaryAction?.path || "#"}
                style={{
                  background: cfg.accent,
                  color: "#fff",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                Open Queue →
              </Link>
            </div>
          )}

          {/* ── Main grid ──────────────────────────────────────────────────── */}
          <div className="grid-content">

            {/* ── LEFT column ──────────────────────────────────────────────── */}
            <div>

              {/* My Parcels (for roles that own parcels) */}
              {["ADVOCATE", "BUYER_SELLER", "REGISTRAR", "ADMIN"].includes(role) && (
                <>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
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
                </>
              )}

              {/* Transfer list — shown to all roles */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  {role === "REGISTRAR"   ? "Pending Approvals"  :
                   role === "CLERK"       ? "Verification Queue" :
                   role === "SURVEYOR"    ? "Assigned Surveys"   :
                   role === "LCB_OFFICER" ? "Consent Requests"   :
                   role === "COUNTY_OFFICER" ? "Clearance Requests":
                   role === "VALUER"      ? "Valuation Queue"    :
                   role === "BUYER_SELLER"? "My Transactions"    :
                                            "My Transactions"}
                </h2>
                <Link to={cfg.primaryAction?.path || "/transfers"} style={{ fontSize: 13, color: C.teal }}>
                  View all →
                </Link>
              </div>

              {pending.length === 0 ? (
                <Card>
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.textSecondary }}>
                    <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>✅</span>
                    <p>No pending items — you're all caught up!</p>
                  </div>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {pending.map((t) => (
                    <Card key={t.transfer_id}>
                      {/* Transfer header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span className="monospace" style={{ fontWeight: 600 }}>
                              Transfer #{t.transfer_id}
                            </span>
                            <Badge status={t.status} />
                          </div>
                          <p style={{ fontSize: 12, color: C.textSecondary }}>
                            📦 Parcel {t.parcel_id}
                            {t.title_number && ` · ${t.title_number}`}
                            {t.transfer_type && ` · ${t.transfer_type}`}
                          </p>
                          {t.prev_owner_name && t.new_owner_name && (
                            <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                              👤 {t.prev_owner_name} → {t.new_owner_name}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`/transfers/${t.transfer_id}`}
                          className="btn btn--secondary btn--sm"
                          style={{ flexShrink: 0 }}
                        >
                          View →
                        </Link>
                      </div>

                      {/* Step progress bar */}
                      <TransferProgress status={t.status} />

                      {/* Current step label */}
                      <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 8 }}>
                        📍 Current step:{" "}
                        <strong style={{ color: C.textPrimary }}>
                          {TRANSFER_STEPS[STATUS_STEP_INDEX[t.status]]?.label ?? t.status}
                        </strong>
                        {" · "}Actor:{" "}
                        <strong style={{ color: C.textPrimary }}>
                          {TRANSFER_STEPS[STATUS_STEP_INDEX[t.status]]?.actor ?? "—"}
                        </strong>
                      </p>

                      {/* Role-specific CTA */}
                      <RoleActionPanel role={role} transfer={t} />
                    </Card>
                  ))}
                </div>
              )}

              {/* Buyer/Seller: stamp duty banner */}
              {role === "BUYER_SELLER" && pending.some(t => t.status === "VALUED") && (
                <div style={{
                  marginTop: 20,
                  background: "#ecfdf5",
                  border: "1.5px solid #059669",
                  borderRadius: 10,
                  padding: "14px 18px",
                }}>
                  <p style={{ fontWeight: 700, color: "#059669", marginBottom: 4 }}>
                    💳 Stamp Duty Ready
                  </p>
                  <p style={{ fontSize: 13, color: C.textSecondary }}>
                    Your land has been valued. Pay stamp duty to proceed to Registrar approval.
                  </p>
                  <Link to="/transfers/stamp-duty" style={{
                    display: "inline-block", marginTop: 10,
                    background: "#059669", color: "#fff",
                    padding: "8px 18px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}>
                    Pay Now →
                  </Link>
                </div>
              )}

              {/* Buyer/Seller: download title */}
              {role === "BUYER_SELLER" && pending.some(t => t.status === "COMPLETED") && (
                <div style={{
                  marginTop: 20,
                  background: "#f0fdf4",
                  border: "1.5px solid #16a34a",
                  borderRadius: 10,
                  padding: "14px 18px",
                }}>
                  <p style={{ fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>
                    🎉 Transfer Complete!
                  </p>
                  <p style={{ fontSize: 13, color: C.textSecondary }}>
                    Your title deed is ready for download.
                  </p>
                  <Link to="/titles" style={{
                    display: "inline-block", marginTop: 10,
                    background: "#16a34a", color: "#fff",
                    padding: "8px 18px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}>
                    Download Title →
                  </Link>
                </div>
              )}

              {/* Quick links */}
              {cfg.quickLinks?.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginTop: 28 }}>Quick Access</h2>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}>
                    {cfg.quickLinks.map(({ label, path, icon }) => (
                      <Link key={path} to={path} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#fff",
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        color: C.textPrimary,
                        fontSize: 14,
                        fontWeight: 500,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        textDecoration: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                      }}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── RIGHT column: Notifications ─────────────────────────────── */}
            <div>
              <h2 className="section-title">Notifications</h2>

              {notifications.length === 0 ? (
                <Card>
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.textSecondary }}>
                    <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🔔</span>
                    <p style={{ fontSize: 13 }}>No notifications yet.</p>
                  </div>
                </Card>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        await notificationsApi.markRead(n.id);
                        setNotifications((prev) =>
                          prev.map((x) =>
                            x.id === n.id ? { ...x, is_read: true } : x
                          )
                        );
                      }}
                      style={{
                        background: C.white,
                        border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${NOTIF_ACCENT[n.type] || C.teal}`,
                        borderRadius: 8,
                        padding: "12px 14px",
                        opacity: n.is_read ? 0.55 : 1,
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                    >
                      {!n.is_read && (
                        <span style={{
                          display: "inline-block",
                          width: 6, height: 6,
                          borderRadius: "50%",
                          background: NOTIF_ACCENT[n.type] || C.teal,
                          marginRight: 6,
                          verticalAlign: "middle",
                        }} />
                      )}
                      <p style={{ fontSize: 13, display: "inline" }}>{n.message}</p>
                      <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>
                        {getAge(n.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Workflow reference card */}
              <div style={{ marginTop: 24 }}>
                <h2 className="section-title">Transfer Workflow</h2>
                <Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {TRANSFER_STEPS.map((step, i) => (
                      <div key={step.key} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        fontSize: 12,
                        opacity: 0.85,
                      }}>
                        <span style={{
                          width: 22, height: 22,
                          borderRadius: "50%",
                          background: "#f3f4f6",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: C.textSecondary,
                          flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ color: C.textSecondary }}>{step.icon}</span>
                        <div>
                          <span style={{ fontWeight: 600, color: C.textPrimary }}>{step.label}</span>
                          <span style={{ color: C.textSecondary }}> · {step.actor}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}