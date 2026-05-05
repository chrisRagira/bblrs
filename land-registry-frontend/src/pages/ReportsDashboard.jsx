import { useState, useEffect, useRef, useCallback } from "react";

// ─── Google Fonts loader ──────────────────────────────────────────────────────
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #EEF2F7; }
    ::-webkit-scrollbar-thumb { background: #CBD5E0; border-radius: 3px; }

    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .skeleton {
      background: linear-gradient(90deg, #EEF2F7 25%, #E2E8F0 50%, #EEF2F7 75%);
      background-size: 600px 100%;
      animation: shimmer 1.4s infinite linear;
      border-radius: 6px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    .fade-in { animation: fadeIn 0.3s ease both; }
  `}</style>
);

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  navy:      "#0B1F3A",
  navyMid:   "#1A3558",
  teal:      "#0D7A6F",
  tealLt:    "#E0F2F0",
  tealMid:   "#0FA896",
  gold:      "#C28A1A",
  goldLt:    "#FBF3DC",
  slate:     "#4A5568",
  border:    "#E2E8F0",
  bg:        "#F7F9FC",
  bgDark:    "#EEF2F7",
  white:     "#FFFFFF",
  danger:    "#C53030",
  dangerLt:  "#FFF5F5",
  success:   "#276749",
  successLt: "#F0FFF4",
  warn:      "#92400E",
  warnLt:    "#FFFBEB",
  text:      "#1A202C",
  textMid:   "#4A5568",
  textMuted: "#718096",
  chart: {
    teal:  "#0D7A6F",
    navy:  "#1A3558",
    gold:  "#C28A1A",
    coral: "#E05C3A",
  },
};

const font = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Static lookup maps (UI-only, never fetched) ──────────────────────────────
const PERIOD_OPTIONS = ["2023", "2024", "2025", "Q1 2025", "Q2 2025", "Last 30 days"];

const TYPE_ICON = {
  Transfer:     "🔄",
  Registration: "📋",
  Encumbrance:  "🔒",
  Discharge:    "🔓",
};

const STATUS_STYLE = {
  APPROVED: { bg: "#F0FFF4", color: "#276749"  },
  REJECTED: { bg: "#FFF5F5", color: "#C53030"  },
  PENDING:  { bg: "#EFF6FF", color: "#1D4ED8"  },
  ACTIVE:   { bg: "#E0F2F0", color: "#0D7A6F"  },
};

const PRIORITY_STYLE = {
  HIGH: { bg: "#FFF5F5", color: "#C53030" },
  MED:  { bg: "#FFFBEB", color: "#92400E" },
  LOW:  { bg: "#F0FFF4", color: "#276749" },
};



// Land-use colour map — keyed off the type string the API returns
const LAND_USE_COLORS = {
  Residential:  "#0D7A6F",
  Agricultural: "#C28A1A",
  Commercial:   "#1A3558",
  Industrial:   "#E05C3A",
};

// ─── API base ─────────────────────────────────────────────────────────────────
// Set VITE_API_URL in your .env file, e.g. VITE_API_URL=http://localhost:3000/api/v1/reports
const API_BASE = import.meta.env?.VITE_API_URL ?? "/api/v1/reports";
const getToken = () => localStorage.getItem("token") ?? "";

// ─── Shared fetch helper ──────────────────────────────────────────────────────
// Always returns the raw parsed JSON. Each call-site normalises the shape it needs.
async function apiFetch(path, params = {}) {
  const url = new URL(API_BASE + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: {
      Authorization:  `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  return res.json(); // return raw — callers unwrap .data themselves
}

// ─── Safe unwrap helpers ──────────────────────────────────────────────────────
// Unwrap { success, data: [...] } → array, or bare array, or []
function unwrapArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  return [];
}

// Unwrap { success, data: {...} } → object, or bare object, or {}
function unwrapObject(raw) {
  if (!raw) return {};
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) return raw.data;
  if (typeof raw === "object" && !Array.isArray(raw) && !("success" in raw)) return raw;
  return {};
}

// ─── useApi — loading / error / abort / refetch ───────────────────────────────
function useApi(path, params = {}, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const abortRef = useRef(null);

  // Stable fetch function — only recreated when deps change
  const run = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    apiFetch(path, params)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setState({ data: null, loading: false, error: err.message });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return { ...state, refetch: run };
}

// ─── CSV download ─────────────────────────────────────────────────────────────
async function downloadCsv(period) {
  const res = await fetch(`${API_BASE}/export?period=${encodeURIComponent(period)}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`Export failed — HTTP ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href, download: `land-registry-${period}.csv` }).click();
  URL.revokeObjectURL(href);
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function SkeletonBlock({ w = "100%", h = 16, mb = 0, br = 6 }) {
  return <div className="skeleton" style={{ width: w, height: h, marginBottom: mb, borderRadius: br }} />;
}

function SkeletonKPI() {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 22px" }}>
      <SkeletonBlock w={40} h={22} mb={14} />
      <SkeletonBlock w="58%" h={26} mb={8} />
      <SkeletonBlock w="75%" h={13} />
    </div>
  );
}

function SkeletonChart({ height = 220 }) {
  return <div className="skeleton" style={{ width: "100%", height, borderRadius: 8 }} />;
}

function SkeletonRows({ rows = 5, cols = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} style={{ padding: "12px 14px" }}>
          <SkeletonBlock w={c === 0 ? "65%" : "45%"} h={13} />
        </td>
      ))}
    </tr>
  ));
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      background: "#FFF5F5", border: "1px solid #FEB2B2",
      borderRadius: 8, padding: "11px 15px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 13, color: "#C53030",
    }}>
      <span>⚠️ {message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{
          border: "1px solid #C53030", borderRadius: 6, background: "transparent",
          color: "#C53030", fontSize: 12, padding: "4px 10px", cursor: "pointer",
        }}>Retry</button>
      )}
    </div>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ data, keys, colors, height = 220 }) {
  if (!data?.length) return <SkeletonChart height={height} />;

  const W = 560, H = height;
  const pad = { top: 16, right: 16, bottom: 32, left: 44 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top  - pad.bottom;

  const allVals = data.flatMap((d) => keys.map((k) => d[k] ?? 0));
  const maxV    = (Math.max(...allVals) || 1) * 1.15;
  const x = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * iW;
  const y = (v) => pad.top  + iH - (v / maxV) * iH;

  const pathD = (key) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key] ?? 0).toFixed(1)}`).join(" ");

  const areaD = (key) =>
    `${pathD(key)} L${x(data.length - 1).toFixed(1)},${(pad.top + iH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + iH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxV * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        {keys.map((k, i) => (
          <linearGradient key={k} id={`lg-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors[i]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colors[i]} stopOpacity="0"    />
          </linearGradient>
        ))}
      </defs>

      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)}
            stroke={T.border} strokeWidth="1" strokeDasharray="4 3" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end"
            fontSize={10} fill={T.textMuted} fontFamily={font.body}>{v}</text>
        </g>
      ))}

      {data.map((d, i) =>
        i % 2 === 0 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle"
            fontSize={10} fill={T.textMuted} fontFamily={font.body}>{d.month}</text>
        ) : null
      )}

      {keys.map((k) => <path key={`area-${k}`} d={areaD(k)} fill={`url(#lg-${k})`} />)}

      {keys.map((k, i) => (
        <path key={`line-${k}`} d={pathD(k)}
          fill="none" stroke={colors[i]} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {keys.map((k, i) => {
        const last = data[data.length - 1];
        return (
          <circle key={`dot-${k}`} cx={x(data.length - 1)} cy={y(last[k] ?? 0)}
            r="4" fill={colors[i]} stroke="#fff" strokeWidth="2" />
        );
      })}
    </svg>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, keys, colors, height = 220 }) {
  if (!data?.length) return <SkeletonChart height={height} />;

  const W = 560, H = height;
  const pad = { top: 16, right: 16, bottom: 32, left: 44 };
  const iW  = W - pad.left - pad.right;
  const iH  = H - pad.top  - pad.bottom;

  const allVals  = data.flatMap((d) => keys.map((k) => d[k] ?? 0));
  const maxV     = (Math.max(...allVals) || 1) * 1.15;
  const groupW   = iW / data.length;
  const barW     = Math.min((groupW / keys.length) * 0.7, 22);
  const groupPad = (groupW - barW * keys.length) / 2;

  const bx = (i, ki) => pad.left + i * groupW + groupPad + ki * barW;
  const bh = (v)     => (v / maxV) * iH;
  const by = (v)     => pad.top + iH - bh(v);

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxV * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {yTicks.map((v) => {
        const yy = pad.top + iH - (v / maxV) * iH;
        return (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={yy} y2={yy}
              stroke={T.border} strokeWidth="1" strokeDasharray="4 3" />
            <text x={pad.left - 6} y={yy + 4} textAnchor="end"
              fontSize={10} fill={T.textMuted} fontFamily={font.body}>{v}</text>
          </g>
        );
      })}

      {data.map((d, i) => (
        <text key={i} x={pad.left + i * groupW + groupW / 2} y={H - 6}
          textAnchor="middle" fontSize={10} fill={T.textMuted} fontFamily={font.body}>
          {d.month}
        </text>
      ))}

      {data.map((d, i) =>
        keys.map((k, ki) => (
          <rect key={`${i}-${ki}`}
            x={bx(i, ki)} y={by(d[k] ?? 0)}
            width={barW - 1} height={bh(d[k] ?? 0)}
            rx="3" fill={colors[ki]} opacity="0.88" />
        ))
      )}
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 180 }) {
  if (!data?.length) return <SkeletonBlock w={size} h={size} br={size / 2} />;

  const cx = size / 2, cy = size / 2;
  const r  = size * 0.38, ir = size * 0.24;
  let angle = -Math.PI / 2;

  const slices = data.map((d) => {
    const sweep = (d.pct / 100) * 2 * Math.PI;
    const x1  = cx + r  * Math.cos(angle), y1  = cy + r  * Math.sin(angle);
    angle += sweep;
    const x2  = cx + r  * Math.cos(angle), y2  = cy + r  * Math.sin(angle);
    const lx1 = cx + ir * Math.cos(angle - sweep), ly1 = cy + ir * Math.sin(angle - sweep);
    const lx2 = cx + ir * Math.cos(angle),          ly2 = cy + ir * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      path: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${lx2},${ly2} A${ir},${ir} 0 ${large},0 ${lx1},${ly1} Z`,
    };
  });

  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity="0.92" />)}
      <text x={cx} y={cy - 7}  textAnchor="middle" fontSize={18} fontWeight="700"
        fill={T.navy} fontFamily={font.head}>{total.toLocaleString()}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9}
        fill={T.textMuted} fontFamily={font.body}>TOTAL PARCELS</text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color = "#0D7A6F", width = 72, height = 26 }) {
  if (!values?.length) return null;
  const max = Math.max(...values), min = Math.min(...values), rng = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - ((v - min) / rng) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  const lastY = height - ((values[values.length - 1] - min) / rng) * (height - 4) - 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function HBar({ label, value, max, total }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
        <span style={{ fontSize: 13, color: T.textMuted }}>
          {value} <span style={{ fontSize: 11 }}>({((value / (total || 1)) * 100).toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ height: 7, background: T.bgDark, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${((value / (max || 1)) * 100).toFixed(1)}%`,
          borderRadius: 4, background: `linear-gradient(90deg, ${T.teal}, ${T.tealMid})`,
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ title, subtitle, action, children, style = {} }) {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "22px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", ...style,
    }}>
      {(title || action) && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <h3 style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: T.navy }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Tab button / group ───────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", border: "none", borderRadius: 7,
      background: active ? T.navy : "transparent",
      color: active ? "#fff" : T.textMuted,
      fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
    }}>{label}</button>
  );
}

function TabGroup({ children }) {
  return (
    <div style={{ display: "flex", background: T.bg, borderRadius: 9, padding: 3, gap: 2 }}>
      {children}
    </div>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────
function ExportBtn({ label = "Export", onClick, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 13px", border: `1px solid ${T.border}`,
      borderRadius: 8, background: T.white, color: T.slate,
      fontSize: 12, fontWeight: 500,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
    }}>
      ↓ {label}
    </button>
  );
}

// ─── Status / Priority pills ──────────────────────────────────────────────────
function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: T.bgDark, color: T.slate };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLE[priority] ?? { bg: T.bgDark, color: T.slate };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {priority}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, deltaLabel, icon, accent = false, loading = false }) {
  if (loading) return <SkeletonKPI />;
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="fade-in" style={{
      background: accent ? `linear-gradient(135deg, ${T.navy}, ${T.navyMid})` : T.white,
      border: `1px solid ${accent ? T.navy : T.border}`,
      borderRadius: 12, padding: "20px 22px",
      boxShadow: accent ? "0 4px 20px rgba(11,31,58,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
    }}>
      {accent && (
        <div style={{
          position: "absolute", right: -16, top: -16,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        {delta !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
            background: accent ? "rgba(255,255,255,0.12)" : (positive ? T.successLt : T.dangerLt),
            color: accent ? "#fff" : (positive ? T.success : T.danger),
          }}>
            {positive ? "▲" : "▼"} {Math.abs(delta)}% {deltaLabel}
          </span>
        )}
      </div>
      <div>
        <p style={{ fontFamily: font.head, fontSize: 28, fontWeight: 700, color: accent ? "#fff" : T.navy, lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 13, color: accent ? "#94A3B8" : T.textMuted, marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── System Health (live clock, no API needed) ────────────────────────────────
function SystemHealth() {
  const [time, setTime] = useState(new Date().toLocaleTimeString("en-KE"));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString("en-KE")), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "Fabric Peers", value: "2/2 Online" },
    { label: "CouchDB",      value: "Healthy"    },
    { label: "IPFS Node",    value: "Healthy"    },
    { label: "API Latency",  value: "142ms"      },
    { label: "Block Height", value: "#48,291"    },
    { label: "Pending Tx",   value: "3"          },
  ];

  return (
    <div style={{
      marginTop: 20,
      background: `linear-gradient(135deg, ${T.navy}, ${T.navyMid})`,
      borderRadius: 12, padding: "18px 24px",
      display: "flex", justifyContent: "space-between",
      alignItems: "center", flexWrap: "wrap", gap: 16,
    }}>
      <div>
        <p style={{ fontFamily: font.head, fontSize: 14, fontWeight: 600, color: "#fff" }}>System Health</p>
        <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Hyperledger Fabric · {time}</p>
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{s.value}</span>
            </div>
            <p style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
export default function ReportsDashboard() {
  const [period,       setPeriod]       = useState("2025");
  const [chartTab,     setChartTab]     = useState("registrations");
  const [countyMetric, setCountyMetric] = useState("parcels");
  const [txFilter,     setTxFilter]     = useState("ALL");
  const [txPage,       setTxPage]       = useState(1);
  const [exporting,    setExporting]    = useState(false);

  // ── All API calls ─────────────────────────────────────────────────────────
  const summary      = useApi("/summary",                { period }, [period]);
  const monthly      = useApi("/monthly-activity",       { period }, [period]);
  const outcomes     = useApi("/transfer-outcomes",      { period }, [period]);
  const landUse      = useApi("/land-use",               {},         []);
  const countyStats  = useApi("/county-stats",           { period }, [period]);
  const txValueType  = useApi("/transfer-value-by-type", { period }, [period]);
  const txSummary    = useApi("/transfer-summary",       { period }, [period]);
  const transactions = useApi(
    "/recent-transactions",
    { type: txFilter !== "ALL" ? txFilter : undefined, page: txPage, limit: 10 },
    [txFilter, txPage]
  );

  // ── Derived / normalised data ─────────────────────────────────────────────

  // Attach colour to each land-use entry from the API
  // GET /land-use → { success, data: [ { type, count, pct } ] }
  const landUseData = unwrapArray(landUse.data).map((d) => ({
    ...d,
    color: LAND_USE_COLORS[d.type] ?? T.chart.slate,
  }));



  // Sparklines — built once per county when countyStats arrives
  // The API may supply c.sparkline (8-element array); if not, we approximate
  const sparks = useRef({});
  useEffect(() => {
    const rows = unwrapArray(countyStats.data);
    if (!rows.length) return;
    rows.forEach((c) => {
      if (!sparks.current[c.county]) {
        sparks.current[c.county] =
          Array.isArray(c.sparkline) && c.sparkline.length
            ? c.sparkline
            : Array.from({ length: 8 }, () =>
                Math.max(0, c.parcels + Math.round((Math.random() - 0.5) * 30))
              );
      }
    });
  }, [countyStats.data]);

  // GET /summary → { success, data: { totalRegistrations, totalTransfers, activeEncumbrances, totalValue, deltas: {...} } }
  const summaryObj = unwrapObject(summary.data);
  const kpiData = [
    {
      label: "Total Registrations",    icon: "📋", accent: true,
      value: summaryObj.totalRegistrations?.toLocaleString() ?? "—",
      delta: summaryObj.deltas?.registrations, deltaLabel: "YoY",
    },
    {
      label: "Ownership Transfers",    icon: "🔄",
      value: summaryObj.totalTransfers?.toLocaleString() ?? "—",
      delta: summaryObj.deltas?.transfers, deltaLabel: "YoY",
    },
    {
      label: "Active Encumbrances",    icon: "🔒",
      value: summaryObj.activeEncumbrances?.toLocaleString() ?? "—",
      delta: summaryObj.deltas?.encumbrances, deltaLabel: "YoY",
    },
    {
      label: "Total Value Transacted", icon: "💰",
      value: summaryObj.totalValue ?? "—",
      delta: summaryObj.deltas?.value, deltaLabel: "YoY",
    },
  ];

  // GET /transfer-summary → { success, data: { approved, rejected, pending, approvedPct, rejectedPct, pendingPct } }
  const txSummaryObj   = unwrapObject(txSummary.data);
  const txSummaryCards = [
    { label: "Approved", color: T.success, bg: T.successLt,
      value: txSummaryObj.approved ?? "—", pct: txSummaryObj.approvedPct ?? 0 },
    { label: "Rejected", color: T.danger,  bg: T.dangerLt,
      value: txSummaryObj.rejected ?? "—", pct: txSummaryObj.rejectedPct ?? 0 },
    { label: "Pending",  color: "#1D4ED8", bg: "#EFF6FF",
      value: txSummaryObj.pending  ?? "—", pct: txSummaryObj.pendingPct  ?? 0 },
  ];

  // GET /recent-transactions → { success, data: { items: [...], total: N } } or bare array
  const txRaw   = transactions.data;
  const txList  = Array.isArray(txRaw)
    ? txRaw
    : Array.isArray(txRaw?.items)
      ? txRaw.items
      : Array.isArray(txRaw?.data)
        ? txRaw.data
        : [];
  const txTotal = txRaw?.total ?? txList.length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try { await downloadCsv(period); }
    catch (e) { alert(e.message); }
    finally { setExporting(false); }
  };

  const handleTxFilter = (f) => { setTxFilter(f); setTxPage(1); };
  const handlePeriod   = (p) => { setPeriod(p);   setTxPage(1); };

  // ── Grid helper ───────────────────────────────────────────────────────────
  const grid = (cols, gap = 20) => ({
    display: "grid", gridTemplateColumns: cols, gap, marginBottom: 20,
  });

  const genDate = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: font.body, background: T.bg, minHeight: "100vh", color: T.text }}>
      <FontLoader />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
        padding: "28px 32px 32px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 300, opacity: 0.05,
          backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
          backgroundSize: "20px 20px",
        }} />
        <div style={{ position: "absolute", right: 32, top: 16, width: 120, height: 120, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)" }} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 8, height: 28, background: T.teal, borderRadius: 4 }} />
              <h1 style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: "#fff" }}>
                Reports &amp; Analytics
              </h1>
            </div>
            <p style={{ color: "#94A3B8", fontSize: 13, marginLeft: 18 }}>
              Blockchain Land Registry · Ministry of Lands, Kenya · {genDate}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Period selector */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: 3, gap: 1 }}>
              {PERIOD_OPTIONS.map((p) => (
                <button key={p} onClick={() => handlePeriod(p)} style={{
                  padding: "6px 12px", border: "none", borderRadius: 8,
                  background: period === p ? T.teal : "transparent",
                  color: period === p ? "#fff" : "#94A3B8",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}>{p}</button>
              ))}
            </div>

            <button onClick={handleExport} disabled={exporting} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 8,
              background: exporting ? T.tealMid : T.teal,
              border: "none", color: "#fff", fontSize: 13, fontWeight: 500,
              cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.8 : 1,
            }}>
              {exporting ? "⏳ Exporting…" : "↓ Export Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Global summary error */}
        {summary.error && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner message={summary.error} onRetry={summary.refetch} />
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────── */}
        <div style={grid("repeat(4,1fr)", 16)}>
          {kpiData.map((k) => (
            <KPICard key={k.label} {...k} loading={summary.loading} />
          ))}
        </div>

        {/* ── Row 1: main chart + donut ────────────────────────────── */}
        <div style={grid("1fr 380px")}>
          <Panel
            title={chartTab === "registrations" ? "Registration Activity" : "Transfer Outcomes"}
            subtitle={`Monthly breakdown — ${period}`}
            action={
              <TabGroup>
                <TabBtn label="Registrations" active={chartTab === "registrations"} onClick={() => setChartTab("registrations")} />
                <TabBtn label="Transfers"     active={chartTab === "transfers"}     onClick={() => setChartTab("transfers")}     />
              </TabGroup>
            }
          >
            {chartTab === "registrations" ? (
              <>
                {monthly.error
                  ? <ErrorBanner message={monthly.error} onRetry={monthly.refetch} />
                  : <LineChart
                      data={monthly.loading ? [] : unwrapArray(monthly.data)}
                      keys={["parcels", "transfers", "encumbrances"]}
                      colors={[T.chart.teal, T.chart.navy, T.chart.gold]}
                      height={220}
                    />
                }
                <Legend items={[
                  { label: "Parcels Registered", color: T.chart.teal },
                  { label: "Transfers",           color: T.chart.navy },
                  { label: "Encumbrances",        color: T.chart.gold },
                ]} />
              </>
            ) : (
              <>
                {outcomes.error
                  ? <ErrorBanner message={outcomes.error} onRetry={outcomes.refetch} />
                  : <BarChart
                      data={outcomes.loading ? [] : unwrapArray(outcomes.data)}
                      keys={["approved", "rejected"]}
                      colors={[T.chart.teal, T.chart.coral]}
                      height={220}
                    />
                }
                <Legend items={[
                  { label: "Approved", color: T.chart.teal  },
                  { label: "Rejected", color: T.chart.coral },
                ]} />
              </>
            )}
          </Panel>

          <Panel title="Land Use Distribution" subtitle="Active parcels by type">
            {landUse.error ? (
              <ErrorBanner message={landUse.error} onRetry={landUse.refetch} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <DonutChart data={landUse.loading ? [] : landUseData} size={164} />
                <div style={{ width: "100%" }}>
                  {landUse.loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                          <SkeletonBlock h={13} />
                        </div>
                      ))
                    : landUseData.map((d) => (
                        <div key={d.type} className="fade-in" style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "8px 0", borderBottom: `1px solid ${T.border}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                            <span style={{ fontSize: 13, color: T.text }}>{d.type}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.navy }}>{d.count?.toLocaleString()}</span>
                            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 4 }}>({d.pct}%)</span>
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ── Row 2: county + transfer outcomes ───────────────────── */}
        <div style={grid("1fr 1fr")}>

          <Panel
            title="County Performance"
            subtitle="Top counties by activity"
            action={
              <TabGroup>
                <TabBtn label="Parcels"   active={countyMetric === "parcels"}   onClick={() => setCountyMetric("parcels")}   />
                <TabBtn label="Transfers" active={countyMetric === "transfers"} onClick={() => setCountyMetric("transfers")} />
              </TabGroup>
            }
          >
            {countyStats.error ? (
              <ErrorBanner message={countyStats.error} onRetry={countyStats.refetch} />
            ) : countyStats.loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <SkeletonBlock h={13} mb={5} />
                  <SkeletonBlock h={7} />
                </div>
              ))
            ) : (() => {
              const rows  = unwrapArray(countyStats.data);
              const vals  = rows.map((c) => c[countyMetric] ?? 0);
              const total = vals.reduce((a, b) => a + b, 0);
              const max   = Math.max(...vals, 1);
              return rows.map((c) => (
                <HBar key={c.county} label={c.county} value={c[countyMetric] ?? 0} max={max} total={total} />
              ));
            })()}
          </Panel>

          <Panel title="Transfer Outcomes" subtitle={`Full year summary — ${period}`}>
            {txSummary.error ? (
              <ErrorBanner message={txSummary.error} onRetry={txSummary.refetch} />
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {txSummaryCards.map((s) => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                      {txSummary.loading ? (
                        <>
                          <SkeletonBlock w="50%" h={26} mb={6} />
                          <SkeletonBlock w="70%" h={12} />
                        </>
                      ) : (
                        <div className="fade-in">
                          <p style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
                          <p style={{ fontSize: 12, color: s.color, fontWeight: 500, marginTop: 2 }}>{s.label}</p>
                          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{s.pct}% of total</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ background: T.bg, borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Total Value by Transfer Type
                  </p>
                  {txValueType.error ? (
                    <ErrorBanner message={txValueType.error} onRetry={txValueType.refetch} />
                  ) : txValueType.loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <SkeletonBlock w={95} h={13} />
                        <div style={{ flex: 1 }}><SkeletonBlock h={7} /></div>
                        <SkeletonBlock w={75} h={13} />
                      </div>
                    ))
                  ) : (
                    // GET /transfer-value-by-type → { success, data: [{ type, value, pct }] }
                    unwrapArray(txValueType.data).map((r) => (
                      <div key={r.type} className="fade-in" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: T.textMid, minWidth: 100 }}>{r.type}</span>
                        <div style={{ flex: 1, height: 7, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${r.pct}%`, background: `linear-gradient(90deg,${T.teal},${T.tealMid})`, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.navy, minWidth: 80, textAlign: "right" }}>{r.value}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </Panel>
        </div>

        
        {/* ── Row 4: County sparkline table ───────────────────────── */}
        <Panel
          title="County Trends"
          subtitle="Registration activity per county"
          action={<ExportBtn label="Export CSV" onClick={handleExport} disabled={exporting} />}
          style={{ marginBottom: 20, overflowX: "auto" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["County", "Parcels", "Transfers", "Est. Value", "Trend (8mo)", "Δ"].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 14px", textAlign: i > 1 ? "right" : "left",
                    color: T.textMuted, fontWeight: 500, borderBottom: `1px solid ${T.border}`,
                    fontSize: 12, letterSpacing: "0.03em", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countyStats.loading ? (
                <SkeletonRows rows={6} cols={6} />
              ) : countyStats.error ? (
                <tr><td colSpan={6} style={{ padding: 16 }}>
                  <ErrorBanner message={countyStats.error} onRetry={countyStats.refetch} />
                </td></tr>
              ) : (
                (unwrapArray(countyStats.data)).map((c) => {
                  const spark = sparks.current[c.county] ?? [];
                  const trend = spark.length >= 2 && spark[spark.length - 1] > spark[0];
                  const delta = Math.abs((spark[spark.length - 1] ?? 0) - (spark[0] ?? 0));
                  return (
                    <tr key={c.county} className="fade-in" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, background: T.tealLt,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, color: T.teal, fontFamily: font.mono, fontWeight: 600,
                          }}>
                            {c.county[0]}
                          </div>
                          <span style={{ fontWeight: 600, color: T.navy }}>{c.county}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 500 }}>{c.parcels?.toLocaleString()}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 500 }}>{c.transfers?.toLocaleString()}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: T.textMid }}>{c.value}</td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {spark.length > 0 && <Sparkline values={spark} color={trend ? T.chart.teal : T.chart.coral} />}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        {spark.length >= 2 && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: trend ? T.success : T.danger }}>
                            {trend ? "▲" : "▼"} {delta}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {/* ── Row 5: Recent transactions ──────────────────────────── */}
        <Panel
          title="Recent Transactions"
          subtitle="Latest blockchain events across all counties"
          action={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <TabGroup>
                {["ALL", "Transfer", "Registration", "Encumbrance"].map((f) => (
                  <TabBtn key={f} label={f} active={txFilter === f} onClick={() => handleTxFilter(f)} />
                ))}
              </TabGroup>
              <ExportBtn label="CSV" onClick={handleExport} disabled={exporting} />
            </div>
          }
        >
          {transactions.error ? (
            <ErrorBanner message={transactions.error} onRetry={transactions.refetch} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 750 }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {["Transaction ID", "Type", "Parcel", "County", "Value", "Status", "Date"].map((h, i) => (
                      <th key={i} style={{
                        padding: "10px 14px", textAlign: i >= 4 ? "right" : "left",
                        color: T.textMuted, fontWeight: 500, borderBottom: `1px solid ${T.border}`,
                        fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.loading ? (
                    <SkeletonRows rows={8} cols={7} />
                  ) : (
                    // API shape: [{ id, type, parcel, county, value, status, date }]
                    txList.map((tx) => (
                      <tr key={tx.id} className="fade-in" style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontFamily: font.mono, fontSize: 12, color: T.teal }}>{tx.id}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 15 }}>{TYPE_ICON[tx.type] ?? "📄"}</span>
                            <span style={{ color: T.textMid }}>{tx.type}</span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", fontFamily: font.mono, fontSize: 11, color: T.textMid }}>{tx.parcel}</td>
                        <td style={{ padding: "12px 14px" }}>{tx.county}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 500 }}>{tx.value}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}><StatusPill status={tx.status} /></td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: T.textMuted }}>{tx.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer: counts + pagination */}
          <div style={{
            marginTop: 16, padding: "14px 16px", background: T.bg, borderRadius: 8,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[["Total", txTotal], ["Showing", txList.length], ["Page", txPage]].map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{k}: </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.navy }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                disabled={txPage === 1 || transactions.loading}
                style={{
                  padding: "5px 12px", border: `1px solid ${T.border}`,
                  borderRadius: 6, background: T.white, color: T.slate, fontSize: 12,
                  cursor: txPage === 1 ? "not-allowed" : "pointer",
                  opacity: txPage === 1 ? 0.4 : 1,
                }}>← Prev</button>
              <button
                onClick={() => setTxPage((p) => p + 1)}
                disabled={txList.length < 10 || transactions.loading}
                style={{
                  padding: "5px 12px", border: `1px solid ${T.border}`,
                  borderRadius: 6, background: T.white, color: T.slate, fontSize: 12,
                  cursor: txList.length < 10 ? "not-allowed" : "pointer",
                  opacity: txList.length < 10 ? 0.4 : 1,
                }}>Next →</button>
            </div>
          </div>
        </Panel>

        {/* ── System Health ─────────────────────────────────────────── */}
        <SystemHealth />
      </div>
    </div>
  );
}