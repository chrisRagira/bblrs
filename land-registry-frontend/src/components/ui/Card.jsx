import { C, font } from "../../styles/tokens";

/** Generic white card */
export function Card({ children, className = "", accent = false, style = {}, ...props }) {
  return (
    <div
      className={`card ${accent ? "card--accent-gold" : ""} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

/** Metric summary card */
export function StatCard({ label, value, icon, accent = false }) {
  return (
    <div className={`stat-card ${accent ? "stat-card--accent" : ""}`}>
      <span className="stat-card__icon">{icon}</span>
      <div>
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
      </div>
    </div>
  );
}

/** Top-of-page title bar with optional action button */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-start", marginBottom: 28,
      paddingBottom: 20, borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <h1 style={{
          fontFamily: font.head, fontSize: 26, fontWeight: 600,
          color: C.navy, marginBottom: 4,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: C.textSecondary, fontSize: 14 }}>{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
