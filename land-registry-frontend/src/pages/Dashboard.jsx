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
import { C } from "../styles/tokens";

// ─── 11-step workflow ────────────────────────────────────────────────────────
const TRANSFER_STEPS = [
  {
    key:   "SALE_INITIATED",
    label: "Sale Initiated",
    icon:  "📝",
    actor: "Seller",
    note:  "Seller initiates sale & selects an advocate by ID. Buyer is notified and must approve the purchase.",
  },
  {
    key:   "ADVOCATE_APPOINTED",
    label: "Agreement Signed",
    icon:  "✍️",
    actor: "Advocate",
    note:  "Advocate is notified of appointment, drafts legal documents. Both parties sign. Advocate uploads docs.",
  },
  {
    key:   "DOCUMENTS_VERIFIED",
    label: "Docs Verified",
    icon:  "🔍",
    actor: "Registry Clerk",
    note:  "Clerk verifies documents & IDs. Appoints a surveyor if required. Notifies LCB if agricultural land.",
  },
  {
    key:      "SURVEY_VERIFIED",
    label:    "Survey Verified",
    icon:     "📐",
    actor:    "Surveyor",
    note:     "Surveyor uploads map & beacon confirmation. Makes boundary adjustments if needed.",
    optional: true,
  },
  {
    key:      "LCB_APPROVED",
    label:    "LCB Approved",
    icon:     "🏛️",
    actor:    "LCB Officer",
    note:     "Required for agricultural land only. LCB approves/rejects consent then forwards to the County Office.",
    optional: true,
  },
  {
    key:   "RATES_CLEARED",
    label: "Rates Cleared",
    icon:  "🏢",
    actor: "County Officer",
    note:  "County officer confirms no outstanding land rates. Forwards to Government Valuer.",
  },
  {
    key:   "VALUED",
    label: "Valued",
    icon:  "💰",
    actor: "Gov. Valuer",
    note:  "Government valuer inputs land value for stamp duty calculation.",
  },
  {
    key:   "STAMP_DUTY_PAID",
    label: "Stamp Duty Paid",
    icon:  "🧾",
    actor: "Buyer / KRA",
    note:  "System notifies buyer of duty amount. Buyer uploads payment proof. KRA API confirms payment.",
  },
  {
    key:   "COMPLIANCE_CHECKED",
    label: "Compliance Check",
    icon:  "✅",
    actor: "System",
    note:  "Automated compliance check across all completed steps before final registrar review.",
  },
  {
    key:   "APPROVED",
    label: "Registrar Approved",
    icon:  "🏛",
    actor: "Registrar",
    note:  "Registrar reviews the full transaction record and issues final approval or rejection.",
  },
  {
    key:   "COMPLETED",
    label: "Title Issued",
    icon:  "🎉",
    actor: "Registrar (System)",
    note:  "System generates a digital title deed and updates land ownership records on the blockchain.",
  },
];

const STATUS_STEP_INDEX = Object.fromEntries(
  TRANSFER_STEPS.map((s, i) => [s.key, i])
);

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  ADVOCATE: {
    label: "Advocate",
    icon: "⚖️",
    accent: C.teal,
    primaryAction: { label: "+ Initiate Transfer", path: "/transfers/new" },
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
    primaryAction: { label: "Pending Transfers", path: "/transfers/pending" },
    quickLinks: [
      { label: "Request Subdivision", path: "/parcels/subdivision/new", icon: "✂️" },
      { label: "Request Merger",      path: "/parcels/merger/new",      icon: "🔗" },
      { label: "Pay Stamp Duty",      path: "/transfers/stamp-duty",    icon: "💳" },
      { label: "Download Title",      path: "/titles",                  icon: "📜" },
    ],
  },
  CLERK: {
    label: "Registry Clerk",
    icon: "🗂️",
    accent: "#d97706",
    primaryAction: { label: "Verification Queue", path: "/clerk/queue" },
    quickLinks: [
      { label: "Pending Verification", path: "/clerk/queue",         icon: "📋" },
      { label: "Register New Parcel",  path: "/clerk/parcels/new",   icon: "➕" },
      { label: "Subdivision Queue",    path: "/clerk/subdivisions",  icon: "✂️" },
      { label: "Merger Queue",         path: "/clerk/mergers",       icon: "🔗" },
    ],
  },
  SURVEYOR: {
    label: "Surveyor",
    icon: "📐",
    accent: "#7c3aed",
    primaryAction: { label: "My Assignments", path: "/surveyor/assignments" },
    quickLinks: [
      { label: "Upload Survey Map", path: "/surveyor/upload",      icon: "🗺️" },
      { label: "Assigned Parcels",  path: "/surveyor/assignments", icon: "📋" },
      { label: "Completed Surveys", path: "/surveyor/completed",   icon: "✅" },
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
      { label: "Rejected",         path: "/lcb/rejected", icon: "❌" },
    ],
  },
  COUNTY_OFFICER: {
    label: "County Officer",
    icon: "🏢",
    accent: "#0e7490",
    primaryAction: { label: "Clearance Queue", path: "/county/queue" },
    quickLinks: [
      { label: "Clearance Requests", path: "/county/queue",   icon: "📋" },
      { label: "Land Rates History", path: "/county/rates",   icon: "📊" },
      { label: "Cleared",            path: "/county/cleared", icon: "✅" },
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
    label: "Land Registrar",
    icon: "🏛",
    accent: C.teal,
    primaryAction: { label: "Approval Queue", path: "/registrar/queue" },
    quickLinks: [
      { label: "Approval Queue",     path: "/registrar/queue",   icon: "📋" },
      { label: "Review New Parcels", path: "/registrar/parcels", icon: "🏘" },
      { label: "Reports",            path: "/admin/reports",     icon: "📊" },
      { label: "Audit Log",          path: "/admin/audit",       icon: "🔎" },
    ],
  },
  FINANCE: {
    label: "Finance Officer",
    icon: "🏦",
    accent: "#0284c7",
    primaryAction: { label: "Create Encumbrance", path: "/finance/encumbrances/new" },
    quickLinks: [
      { label: "Active Encumbrances",   path: "/finance/encumbrances",          icon: "🔒" },
      { label: "Create Encumbrance",    path: "/finance/encumbrances/new",      icon: "➕" },
      { label: "Discharge",             path: "/finance/encumbrances/discharge",icon: "✅" },
      { label: "History",               path: "/finance/encumbrances/history",  icon: "📊" },
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

// ─── Stats per role ───────────────────────────────────────────────────────────
function getRoleStats(role, parcels, pending) {
  const active     = parcels.filter(p => p.status === "ACTIVE").length;
  const encumbered = parcels.filter(p => p.status === "ENCUMBERED").length;
  const byStatus   = (s) => pending.filter(t => t.status === s).length;

  const maps = {
    ADVOCATE: [
      { label: "My Transactions", value: pending.length,                                                 icon: "📋" },
      { label: "Awaiting Buyer",  value: byStatus("SALE_INITIATED"),                                    icon: "⏳" },
      { label: "In Progress",     value: byStatus("DOCUMENTS_VERIFIED") + byStatus("SURVEY_VERIFIED"),  icon: "🔄", accent: true },
      { label: "Completed",       value: byStatus("COMPLETED"),                                          icon: "🎉" },
    ],
    BUYER_SELLER: [
      { label: "My Parcels",    value: parcels.length,             icon: "🏘" },
      { label: "Pending",       value: byStatus("SALE_INITIATED"), icon: "🔔", accent: true },
      { label: "Stamp Duty Due",value: byStatus("VALUED"),         icon: "💳" },
      { label: "Completed",     value: byStatus("COMPLETED"),      icon: "🎉" },
    ],
    CLERK: [
      { label: "Pending Verification", value: byStatus("ADVOCATE_APPOINTED"), icon: "📋", accent: true },
      { label: "Verified",             value: byStatus("DOCUMENTS_VERIFIED"), icon: "✅" },
      { label: "Parcels Registered",   value: parcels.length,                 icon: "🏘" },
      { label: "Total Processed",      value: pending.length,                 icon: "📊" },
    ],
    SURVEYOR: [
      { label: "Assigned",       value: byStatus("DOCUMENTS_VERIFIED"), icon: "📋", accent: true },
      { label: "Completed",      value: byStatus("SURVEY_VERIFIED"),    icon: "✅" },
      { label: "Total Parcels",  value: parcels.length,                 icon: "🏘" },
      { label: "Pending Upload", value: byStatus("DOCUMENTS_VERIFIED"), icon: "📐" },
    ],
    LCB_OFFICER: [
      { label: "Consent Requests", value: byStatus("SURVEY_VERIFIED"), icon: "📋", accent: true },
      { label: "Approved",         value: byStatus("LCB_APPROVED"),    icon: "✅" },
      { label: "Total Reviewed",   value: pending.length,              icon: "📊" },
      { label: "Pending",          value: byStatus("SURVEY_VERIFIED"), icon: "⏳" },
    ],
    COUNTY_OFFICER: [
      { label: "Clearance Requests", value: byStatus("LCB_APPROVED"),  icon: "📋", accent: true },
      { label: "Cleared",            value: byStatus("RATES_CLEARED"), icon: "✅" },
      { label: "Total Processed",    value: pending.length,            icon: "📊" },
      { label: "Pending",            value: byStatus("LCB_APPROVED"),  icon: "⏳" },
    ],
    VALUER: [
      { label: "Pending Valuation", value: byStatus("RATES_CLEARED"), icon: "💰", accent: true },
      { label: "Valued",            value: byStatus("VALUED"),        icon: "✅" },
      { label: "Total Processed",   value: pending.length,            icon: "📊" },
      { label: "Awaiting",          value: byStatus("RATES_CLEARED"), icon: "⏳" },
    ],
    REGISTRAR: [
      { label: "Final Approvals Due", value: byStatus("COMPLIANCE_CHECKED"), icon: "📋", accent: true },
      { label: "Approved",            value: byStatus("APPROVED"),            icon: "✅" },
      { label: "Titles Issued",       value: byStatus("COMPLETED"),           icon: "🎉" },
      { label: "Pending Parcels",     value: parcels.length,                  icon: "🏘" },
    ],
    FINANCE: [
      { label: "Active Encumbrances", value: encumbered,     icon: "🔒", accent: true },
      { label: "Total Parcels",       value: parcels.length, icon: "🏘" },
      { label: "Active",              value: active,         icon: "✅" },
      { label: "Transactions",        value: pending.length, icon: "📋" },
    ],
    ADMIN: [
      { label: "Total Parcels", value: parcels.length, icon: "🏘" },
      { label: "Transfers",     value: pending.length, icon: "🔄" },
      { label: "Active",        value: active,         icon: "✅" },
      { label: "Encumbered",    value: encumbered,     icon: "🔒" },
    ],
  };

  return maps[role] || maps.BUYER_SELLER;
}

// ─── Which status triggers each role's action ─────────────────────────────────
const ACTION_STATUS = {
  BUYER_SELLER:   "SALE_INITIATED",
  CLERK:          "ADVOCATE_APPOINTED",
  SURVEYOR:       "DOCUMENTS_VERIFIED",
  LCB_OFFICER:    "SURVEY_VERIFIED",
  COUNTY_OFFICER: "LCB_APPROVED",
  VALUER:         "RATES_CLEARED",
  REGISTRAR:      "COMPLIANCE_CHECKED",
};

// ─── Inline CTA inside each transfer card ────────────────────────────────────
function RoleActionPanel({ role, transfer }) {
  const panels = {
    BUYER_SELLER: {
      triggerStatus: "SALE_INITIATED",
      cta:   "Approve Purchase",
      path:  `/transfers/${transfer?.transfer_id}/buyer-approve`,
      color: "#6366f1",
      desc:  "You have been selected as the buyer. Approve to proceed and appoint an advocate.",
    },
    CLERK: {
      triggerStatus: "ADVOCATE_APPOINTED",
      cta:   "Start Verification",
      path:  `/clerk/queue/${transfer?.transfer_id}`,
      color: "#d97706",
      desc:  "Advocate has uploaded documents. Verify IDs and appoint a surveyor if required.",
    },
    SURVEYOR: {
      triggerStatus: "DOCUMENTS_VERIFIED",
      cta:   "Upload Survey",
      path:  `/surveyor/assignments/${transfer?.transfer_id}`,
      color: "#7c3aed",
      desc:  "Upload survey map & beacon confirmation. Make boundary adjustments if needed.",
    },
    LCB_OFFICER: {
      triggerStatus: "SURVEY_VERIFIED",
      cta:   "Review Consent",
      path:  `/lcb/queue/${transfer?.transfer_id}`,
      color: "#b45309",
      desc:  "Agricultural land consent required. Approve or reject and forward to the County Office.",
    },
    COUNTY_OFFICER: {
      triggerStatus: "LCB_APPROVED",
      cta:   "Approve Clearance",
      path:  `/county/queue/${transfer?.transfer_id}`,
      color: "#0e7490",
      desc:  "Confirm no outstanding land rates on this parcel before forwarding to the valuer.",
    },
    VALUER: {
      triggerStatus: "RATES_CLEARED",
      cta:   "Submit Valuation",
      path:  `/valuer/queue/${transfer?.transfer_id}`,
      color: "#15803d",
      desc:  "Input the government valuation figure used for stamp duty calculation.",
    },
    REGISTRAR: {
      triggerStatus: "COMPLIANCE_CHECKED",
      cta:   "Final Approval",
      path:  `/registrar/queue/${transfer?.transfer_id}`,
      color: C.teal,
      desc:  "Compliance check passed. Review full transaction and issue final approval or rejection.",
    },
  };

  const panel = panels[role];
  if (!panel || !transfer || transfer.status !== panel.triggerStatus) return null;

  return (
    <div style={{
      background: `${panel.color}10`,
      border: `1.5px solid ${panel.color}35`,
      borderRadius: 8,
      padding: "10px 14px",
      marginTop: 12,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: panel.color, marginBottom: 2 }}>⚡ Action Required</p>
        <p style={{ fontSize: 11, color: C.textSecondary }}>{panel.desc}</p>
      </div>
      <Link to={panel.path} style={{
        background: panel.color, color: "#fff",
        padding: "7px 14px", borderRadius: 7,
        fontSize: 12, fontWeight: 600,
        whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0,
      }}>
        {panel.cta} →
      </Link>
    </div>
  );
}

// ─── Compact progress bar (for non-buyer role transfer cards) ─────────────────
function TransferProgressBar({ status }) {
  const currentIdx = STATUS_STEP_INDEX[status] ?? -1;
  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", minWidth: 580 }}>
        {TRANSFER_STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const current = i === currentIdx;
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < TRANSFER_STEPS.length - 1 ? 1 : "none" }}>
              <div
                title={`${i + 1}. ${step.label} · ${step.actor}${step.optional ? " (optional)" : ""}`}
                style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: done ? C.teal : current ? C.gold : "#e5e7eb",
                  border: current ? `2px solid ${C.gold}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: done || current ? "#fff" : "#9ca3af",
                  boxShadow: current ? `0 0 0 3px ${C.gold}33` : "none",
                }}
              >
                {done ? "✓" : step.optional ? "○" : i + 1}
              </div>
              {i < TRANSFER_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? C.teal : "#e5e7eb" }} />
              )}
            </div>
          );
        })}
      </div>
      {currentIdx >= 0 && (
        <p style={{ fontSize: 10, color: C.textSecondary, marginTop: 4 }}>
          Step {currentIdx + 1}/{TRANSFER_STEPS.length}:{" "}
          <strong style={{ color: C.textPrimary }}>{TRANSFER_STEPS[currentIdx]?.label}</strong>
          {" · "}{TRANSFER_STEPS[currentIdx]?.actor}
          {TRANSFER_STEPS[currentIdx]?.optional && (
            <span style={{ color: C.gold, marginLeft: 4 }}>(optional)</span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Buyer/Seller: full transfer progress with tabs ───────────────────────────
function TransferProgressTabs({ transfers }) {
  const [activeId, setActiveId] = useState(transfers[0]?.transfer_id ?? null);
  const active = transfers.find(t => t.transfer_id === activeId) || transfers[0];

  if (!active) return null;

  const currentIdx = STATUS_STEP_INDEX[active.status] ?? -1;

  return (
    <div>
      {/* Tabs */}
      {transfers.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {transfers.map(t => (
            <button
              key={t.transfer_id}
              onClick={() => setActiveId(t.transfer_id)}
              style={{
                padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: t.transfer_id === activeId ? "#6366f1" : "#f3f4f6",
                color:      t.transfer_id === activeId ? "#fff"    : C.textSecondary,
              }}
            >
              #{t.transfer_id}
            </button>
          ))}
        </div>
      )}

      <Card>
        {/* Transfer header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="monospace" style={{ fontWeight: 600 }}>Transfer #{active.transfer_id}</span>
              <Badge status={active.status} />
            </div>
            <p style={{ fontSize: 12, color: C.textSecondary }}>
              📦 Parcel {active.parcel_id}
              {active.title_number && ` · ${active.title_number}`}
              {active.transfer_type && ` · ${active.transfer_type}`}
            </p>
            {active.prev_owner_name && active.new_owner_name && (
              <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                👤 {active.prev_owner_name} → {active.new_owner_name}
              </p>
            )}
          </div>
          <Link to={`/transfers/${active.transfer_id}`} className="btn btn--secondary btn--sm">
            Full Details →
          </Link>
        </div>

        {/* Step list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TRANSFER_STEPS.map((step, i) => {
            const done    = i < currentIdx;
            const current = i === currentIdx;
            const future  = i > currentIdx;
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: future ? 0.4 : 1 }}>
                {/* Bubble */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: done ? C.teal : current ? C.gold : "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, color: done || current ? "#fff" : "#9ca3af",
                  marginTop: 1,
                  boxShadow: current ? `0 0 0 3px ${C.gold}22` : "none",
                }}>
                  {done ? "✓" : step.icon}
                </div>
                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{
                      fontSize: 12,
                      fontWeight: current ? 700 : 500,
                      color: current ? C.textPrimary : done ? C.teal : "#9ca3af",
                    }}>
                      {step.label}
                    </p>
                    {step.optional && (
                      <span style={{ fontSize: 10, color: C.gold, background: `${C.gold}18`, padding: "1px 6px", borderRadius: 99 }}>
                        optional
                      </span>
                    )}
                    {current && (
                      <span style={{ fontSize: 10, color: C.gold, background: `${C.gold}18`, padding: "1px 6px", borderRadius: 99 }}>
                        ← current
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.textSecondary }}>{step.actor}</p>
                  {current && (
                    <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2, fontStyle: "italic" }}>
                      {step.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contextual CTAs */}
        {active.status === "SALE_INITIATED" && (
          <ActionBanner
            color="#6366f1"
            title="🔔 Purchase Approval Needed"
            desc="You have been selected as buyer. Approve to proceed and appoint an advocate."
            cta="Approve Purchase"
            href={`/transfers/${active.transfer_id}/buyer-approve`}
          />
        )}
        {active.status === "VALUED" && (
          <ActionBanner
            color="#059669"
            title="💳 Stamp Duty Ready"
            desc="Your land has been valued. Upload payment proof to proceed."
            cta="Pay Now"
            href={`/transfers/${active.transfer_id}/stamp-duty`}
          />
        )}
        {active.status === "COMPLETED" && (
          <ActionBanner
            color="#16a34a"
            title="🎉 Title Deed Ready!"
            desc="Download your digital title deed from the blockchain registry."
            cta="Download Title"
            href="/titles"
          />
        )}
      </Card>
    </div>
  );
}

// ─── Reusable action banner ───────────────────────────────────────────────────
function ActionBanner({ color, title, desc, cta, href }) {
  return (
    <div style={{
      marginTop: 14,
      background: `${color}0d`,
      border: `1.5px solid ${color}`,
      borderRadius: 8,
      padding: "10px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}>
      <div>
        <p style={{ fontWeight: 700, color, fontSize: 13 }}>{title}</p>
        <p style={{ fontSize: 12, color: C.textSecondary }}>{desc}</p>
      </div>
      <Link to={href} style={{
        background: color, color: "#fff",
        padding: "7px 14px", borderRadius: 7,
        fontSize: 12, fontWeight: 600,
        textDecoration: "none", flexShrink: 0,
      }}>
        {cta} →
      </Link>
    </div>
  );
}

// ─── Finance: encumbrance panel ───────────────────────────────────────────────
function FinanceDashboard({ parcels }) {
  const encumbered = parcels.filter(p => p.status === "ENCUMBERED");
  const clean      = parcels.filter(p => p.status !== "ENCUMBERED");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Active Encumbrances</h2>
        <Link to="/finance/encumbrances/new" style={{ fontSize: 13, color: "#0284c7" }}>+ Create →</Link>
      </div>

      {encumbered.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "20px 0", color: C.textSecondary }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🔓</span>
            <p>No active encumbrances.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {encumbered.map(p => (
            <Card key={p.parcelID}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="monospace">{p.titleNumber}</span>
                    <Badge status={p.status} />
                  </div>
                  <p style={{ fontSize: 12, color: C.textSecondary }}>📍 {p.county} · 📐 {p.areaHectares} ha</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link to={`/finance/encumbrances/${p.parcelID}`} className="btn btn--secondary btn--sm">View</Link>
                  <Link to={`/finance/encumbrances/${p.parcelID}/discharge`} style={{
                    background: "#0284c7", color: "#fff",
                    padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    textDecoration: "none",
                  }}>Discharge</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Encumber a Parcel</h2>
      </div>
      {clean.length === 0 ? (
        <Card><p style={{ fontSize: 13, color: C.textSecondary, padding: "10px 0" }}>All parcels are currently encumbered.</p></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clean.map(p => (
            <Card key={p.parcelID}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="monospace" style={{ marginRight: 8 }}>{p.titleNumber}</span>
                  <Badge status={p.status} />
                  <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
                    📍 {p.county} · 📐 {p.areaHectares} ha · {p.landUseType}
                  </p>
                </div>
                <Link to={`/finance/encumbrances/new?parcel=${p.parcelID}`} className="btn btn--secondary btn--sm">
                  Encumber →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Clerk: parcel registration notice ───────────────────────────────────────
function ClerkParcelPanel() {
  return (
    <div style={{
      marginTop: 24,
      background: "#fffbeb",
      border: "1.5px solid #d97706",
      borderRadius: 10,
      padding: "14px 18px",
    }}>
      <p style={{ fontWeight: 700, color: "#d97706", marginBottom: 4, fontSize: 14 }}>➕ Register New Parcel</p>
      <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10 }}>
        Parcels registered by a clerk are submitted for Registrar review before being published on the registry.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Link to="/clerk/parcels/new" style={{
          background: "#d97706", color: "#fff",
          padding: "8px 16px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, textDecoration: "none",
        }}>
          Register Parcel →
        </Link>
        <Link to="/clerk/parcels/pending" style={{
          background: "#fff", color: "#d97706",
          padding: "8px 16px", borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          textDecoration: "none", border: "1.5px solid #d97706",
        }}>
          Pending Registrar Review
        </Link>
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────
const NOTIF_ACCENT = { success: C.success, warn: C.gold, info: C.teal, danger: C.danger };

function NotificationsPanel({ notifications, setNotifications }) {
  if (notifications.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "24px 0", color: C.textSecondary }}>
          <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>🔔</span>
          <p style={{ fontSize: 13 }}>No notifications yet.</p>
        </div>
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          onClick={async () => {
            await notificationsApi.markRead(n.id);
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
          }}
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${NOTIF_ACCENT[n.type] || C.teal}`,
            borderRadius: 8,
            padding: "12px 14px",
            opacity: n.is_read ? 0.55 : 1,
            cursor: "pointer",
          }}
        >
          {!n.is_read && (
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: NOTIF_ACCENT[n.type] || C.teal,
              marginRight: 6, verticalAlign: "middle",
            }} />
          )}
          <p style={{ fontSize: 13, display: "inline" }}>{n.message}</p>
          <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>{getAge(n.created_at)}</p>
        </div>
      ))}
    </div>
  );
}

function getAge(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
  const h = Math.floor((Date.now() - new Date(ts)) / 3600000);
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [parcels,       setParcels]       = useState([]);
  const [pending,       setPending]       = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const cfg             = ROLE_CONFIG[role] || ROLE_CONFIG.BUYER_SELLER;
  const myActionStatus  = ACTION_STATUS[role];
  const actionableItems = myActionStatus ? pending.filter(t => t.status === myActionStatus) : [];

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

        const combined = [
          ...new Map(
            [...(tuRes.data.data || []), ...(tRes.data.data || [])].map(t => [t.transfer_id, t])
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

  return (
    <div className="page-wrapper">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Welcome, ${user?.first_name || "User"}`}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              background: `${cfg.accent}18`, color: cfg.accent,
              padding: "2px 10px", borderRadius: 99,
              fontSize: 12, fontWeight: 600,
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
            {getRoleStats(role, parcels, pending).map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
            ))}
          </div>

          {/* ── Action alert (non-buyer roles) ─────────────────────────────── */}
          {role !== "BUYER_SELLER" && actionableItems.length > 0 && (
            <div style={{
              background: `${cfg.accent}0e`, border: `1.5px solid ${cfg.accent}35`,
              borderRadius: 12, padding: "14px 18px", marginBottom: 20,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: cfg.accent }}>
                  {cfg.icon} {actionableItems.length} item{actionableItems.length > 1 ? "s" : ""} awaiting your action
                </p>
                <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                  Act to keep the land transfer process moving.
                </p>
              </div>
              <Link to={cfg.primaryAction?.path || "#"} style={{
                background: cfg.accent, color: "#fff",
                padding: "9px 18px", borderRadius: 8,
                fontWeight: 600, fontSize: 13,
                textDecoration: "none", flexShrink: 0,
              }}>
                Open Queue →
              </Link>
            </div>
          )}

          {/* ── Two-column layout ──────────────────────────────────────────── */}
          <div className="grid-content">

            {/* ── LEFT ─────────────────────────────────────────────────────── */}
            <div>

              {/* ══ BUYER_SELLER layout ══ */}
              {role === "BUYER_SELLER" && (
                <>
                  {/* My Parcels */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>My Parcels</h2>
                  </div>

                  {parcels.length === 0 ? (
                    <Card>
                      <div style={{ textAlign: "center", padding: "24px 0", color: C.textSecondary }}>
                        <span style={{ fontSize: 36, display: "block", marginBottom: 10 }}>🏘</span>
                        <p>No parcels registered to your account yet.</p>
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                      {parcels.map(p => (
                        <Card key={p.parcelID}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span className="monospace">{p.titleNumber}</span>
                                <Badge status={p.status} />
                              </div>
                              <p style={{ fontSize: 13, color: C.textSecondary }}>
                                📍 {p.county} · 📐 {p.areaHectares} ha · {p.landUseType}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <Link to={`/parcels/${p.parcelID}/subdivision`} className="btn btn--secondary btn--sm">✂️</Link>
                              <Link to={`/parcels/${p.parcelID}`} className="btn btn--secondary btn--sm">View →</Link>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Transfer progress tabs */}
                  {pending.length > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <h2 className="section-title" style={{ marginBottom: 0 }}>Transfer Progress</h2>
                        <Link to="/parcels/merger/new" style={{ fontSize: 13, color: "#6366f1" }}>🔗 Request Merger →</Link>
                      </div>
                      <TransferProgressTabs transfers={pending} />
                    </>
                  )}

                  {/* Quick links */}
                  <h2 className="section-title" style={{ marginTop: 24 }}>Quick Access</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {cfg.quickLinks.map(({ label, path, icon }) => (
                      <Link key={path} to={path} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        background: "#fff", border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: "14px 16px",
                        color: C.textPrimary, fontSize: 14, fontWeight: 500,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textDecoration: "none",
                      }}>
                        <span style={{ fontSize: 20 }}>{icon}</span>{label}
                      </Link>
                    ))}
                  </div>
                </>
              )}

              {/* ══ FINANCE layout ══ */}
              {role === "FINANCE" && <FinanceDashboard parcels={parcels} />}

              {/* ══ All other roles ══ */}
              {role !== "BUYER_SELLER" && role !== "FINANCE" && (
                <>
                  {/* Parcel list for roles that own/manage parcels */}
                  {["ADVOCATE", "REGISTRAR", "ADMIN"].includes(role) && parcels.length > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h2 className="section-title" style={{ marginBottom: 0 }}>My Parcels</h2>
                        <Link to="/search" style={{ fontSize: 13, color: C.teal }}>Browse all →</Link>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                        {parcels.map(p => (
                          <Card key={p.parcelID}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span className="monospace">{p.titleNumber}</span>
                                  <Badge status={p.status} />
                                </div>
                                <p style={{ fontSize: 13, color: C.textSecondary }}>
                                  📍 {p.county} · 📐 {p.areaHectares} ha · {p.landUseType}
                                </p>
                              </div>
                              <Link to={`/parcels/${p.parcelID}`} className="btn btn--secondary btn--sm">View →</Link>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Transfer queue */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      {role === "REGISTRAR"      ? "Final Approval Queue"  :
                       role === "CLERK"          ? "Verification Queue"    :
                       role === "SURVEYOR"       ? "Assigned Surveys"      :
                       role === "LCB_OFFICER"    ? "Consent Requests"      :
                       role === "COUNTY_OFFICER" ? "Clearance Requests"    :
                       role === "VALUER"         ? "Valuation Queue"       :
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
                        <p>All caught up — no pending items.</p>
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {pending.map(t => (
                        <Card key={t.transfer_id}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span className="monospace" style={{ fontWeight: 600 }}>Transfer #{t.transfer_id}</span>
                                <Badge status={t.status} />
                              </div>
                              <p style={{ fontSize: 12, color: C.textSecondary }}>
                                📦 {t.parcel_id}{t.title_number && ` · ${t.title_number}`}{t.transfer_type && ` · ${t.transfer_type}`}
                              </p>
                              {t.prev_owner_name && t.new_owner_name && (
                                <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                                  👤 {t.prev_owner_name} → {t.new_owner_name}
                                </p>
                              )}
                            </div>
                            <Link to={`/transfers/${t.transfer_id}`} className="btn btn--secondary btn--sm" style={{ flexShrink: 0 }}>
                              View →
                            </Link>
                          </div>
                          <TransferProgressBar status={t.status} />
                          <RoleActionPanel role={role} transfer={t} />
                        </Card>
                      ))}
                    </div>
                  )}

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

                  {/* Clerk extras */}
                  {role === "CLERK" && <ClerkParcelPanel />}

                  {/* Quick links */}
                  {cfg.quickLinks?.length > 0 && (
                    <>
                      <h2 className="section-title" style={{ marginTop: 28 }}>Quick Access</h2>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {cfg.quickLinks.map(({ label, path, icon }) => (
                          <Link key={path} to={path} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            background: "#fff", border: `1px solid ${C.border}`,
                            borderRadius: 10, padding: "14px 16px",
                            color: C.textPrimary, fontSize: 14, fontWeight: 500,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", textDecoration: "none",
                          }}>
                            <span style={{ fontSize: 20 }}>{icon}</span>{label}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* ── RIGHT: Notifications + role side panels ───────────────────── */}
            <div>
              <h2 className="section-title">Notifications</h2>
              <NotificationsPanel notifications={notifications} setNotifications={setNotifications} />

              {/* Finance: encumbrance guide */}
              {role === "FINANCE" && (
                <div style={{ marginTop: 20 }}>
                  <Card>
                    <p style={{ fontWeight: 700, color: "#0284c7", marginBottom: 8, fontSize: 14 }}>🏦 Encumbrance Types</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: C.textSecondary }}>
                      {[
                        ["Mortgage",  "Register a mortgage against a parcel as security for a loan."],
                        ["Caveat",    "Lodge a caveat to protect a party's interest in a property."],
                        ["Charge",    "Register a charge (e.g. unpaid rates) against a parcel."],
                        ["Discharge", "Release an encumbrance once the obligation is satisfied."],
                      ].map(([term, def]) => (
                        <div key={term}>
                          <span style={{ fontWeight: 600, color: C.textPrimary }}>{term}: </span>{def}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Clerk: subdivision & merger queue links */}
              {role === "CLERK" && (
                <div style={{ marginTop: 20 }}>
                  <h2 className="section-title">Special Requests</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Subdivision Requests", path: "/clerk/subdivisions", icon: "✂️", color: "#7c3aed" },
                      { label: "Merger Requests",      path: "/clerk/mergers",      icon: "🔗", color: "#0e7490" },
                    ].map(({ label, path, icon, color }) => (
                      <Link key={path} to={path} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "#fff", border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: "12px 16px",
                        color: C.textPrimary, fontWeight: 500, fontSize: 14,
                        textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}>
                        <span style={{ fontSize: 22 }}>{icon}</span>
                        <span>{label}</span>
                        <span style={{ marginLeft: "auto", color, fontWeight: 700, fontSize: 13 }}>View →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}