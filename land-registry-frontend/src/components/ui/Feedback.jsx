import { Link } from "react-router-dom";
import { C } from "../../styles/tokens";

/* ── Alert Banner ──────────────────────────────────────────────────────────── */
const ALERT_ICONS = { info: "ℹ", success: "✓", warn: "⚠", danger: "✕" };

export function Alert({ type = "info", children }) {
  return (
    <div className={`alert alert--${type}`}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{ALERT_ICONS[type]}</span>
      <span>{children}</span>
    </div>
  );
}

/* ── Breadcrumb ────────────────────────────────────────────────────────────── */
export function Breadcrumb({ items }) {
  return (
    <nav style={{
      display: "flex", gap: 6, alignItems: "center",
      marginBottom: 20, fontSize: 13, color: C.textSecondary,
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span>›</span>}
          {item.to ? (
            <Link to={item.to} style={{ color: C.teal }}>{item.label}</Link>
          ) : (
            <span style={{ color: i === items.length - 1 ? C.textPrimary : C.textSecondary }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ── Step Progress Bar ─────────────────────────────────────────────────────── */
export function StepBar({ steps, current }) {
  return (
    <div className="step-bar">
      {steps.map((label, i) => {
        const done   = i < current - 1;
        const active = i === current - 1;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div className={`step-dot ${done ? "step-dot--done" : active ? "step-dot--active" : "step-dot--pending"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.navy : C.textSecondary, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line ${done ? "step-line--done" : "step-line--pending"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab Bar ───────────────────────────────────────────────────────────────── */
export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`tab-btn ${active === tab ? "tab-btn--active" : ""}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/* ── Loading Spinner ───────────────────────────────────────────────────────── */
export function Spinner({ size = 32 }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <div style={{
        width: size, height: size,
        border: `3px solid ${C.border}`,
        borderTopColor: C.teal,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────────────────── */
export function EmptyState({ icon = "📭", title, message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.textSecondary }}>
      <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>{icon}</span>
      <p style={{ fontSize: 16, fontWeight: 500, color: C.navy, marginBottom: 6 }}>{title}</p>
      {message && <p style={{ fontSize: 14 }}>{message}</p>}
    </div>
  );
}
