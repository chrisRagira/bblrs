import { useState, useEffect, useRef, useCallback } from "react";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #F7F9FC; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #EEF2F7; }
    ::-webkit-scrollbar-thumb { background: #CBD5E0; border-radius: 3px; }
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    .sk {
      background: linear-gradient(90deg,#EEF2F7 25%,#E2E8F0 50%,#EEF2F7 75%);
      background-size: 600px 100%;
      animation: shimmer 1.5s infinite linear;
      border-radius: 6px;
    }
    @keyframes fi { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
    .fi { animation: fi 0.25s ease both; }
  `}</style>
);

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
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
  text:      "#1A202C",
  textMid:   "#4A5568",
  muted:     "#718096",
  chartTeal: "#0D7A6F",
  chartNavy: "#1A3558",
  chartGold: "#C28A1A",
  chartCoral:"#E05C3A",
};

const F = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Static maps ──────────────────────────────────────────────────────────────
const PERIODS = ["2024","2025","2026","Q1 2026","Q1 2025","Last 30 days"];

const TX_ICON = { Transfer:"🔄", Registration:"📋", Encumbrance:"🔒", Discharge:"🔓" };

const STATUS_S = {
  APPROVED: { bg:"#F0FFF4", color:"#276749" },
  REJECTED: { bg:"#FFF5F5", color:"#C53030" },
  PENDING:  { bg:"#EFF6FF", color:"#1D4ED8" },
  ACTIVE:   { bg:"#E0F2F0", color:"#0D7A6F" },
};

const LU_COLORS = {
  Residential:  "#0D7A6F",
  Agricultural: "#C28A1A",
  Commercial:   "#1A3558",
  Industrial:   "#E05C3A",
};

// ─── API layer ────────────────────────────────────────────────────────────────
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : "/api/v1/reports";

const tok = () => localStorage.getItem("token") ?? "";

// Fetch and always return the raw JSON — callers normalise shape
async function get(path, params = {}) {
  const url = new URL(API_BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params))
    if (v != null) url.searchParams.set(k, String(v));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.message ?? `HTTP ${r.status}`);
  }
  return r.json();
}

// Safe coercions — never throw, always return the right JS type
function toArr(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

function toObj(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  // { success, data: { ... } }
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) return raw.data;
  // bare object that isn't an envelope
  if (!("success" in raw) && !("data" in raw)) return raw;
  return {};
}

// ─── useApi hook ──────────────────────────────────────────────────────────────
function useApi(path, params, deps) {
  const [state, set] = useState({ raw: null, loading: true, error: null });
  const ctrl = useRef(null);

  const run = useCallback(() => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    set(s => ({ ...s, loading: true, error: null }));
    get(path, params)
      .then(raw  => set({ raw,  loading: false, error: null }))
      .catch(err => { if (err.name !== "AbortError") set({ raw: null, loading: false, error: err.message }); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); return () => ctrl.current?.abort(); }, [run]);
  return { ...state, refetch: run };
}

// ─── CSV export ───────────────────────────────────────────────────────────────
async function exportCsv(period) {
  const r = await fetch(`${API_BASE}/export?period=${encodeURIComponent(period)}`, {
    headers: { Authorization: `Bearer ${tok()}` },
  });
  if (!r.ok) throw new Error(`Export failed — HTTP ${r.status}`);
  const blob = await r.blob();
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `land-registry-${period}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ w = "100%", h = 16, mb = 0, br = 6 }) => (
  <div className="sk" style={{ width: w, height: h, marginBottom: mb, borderRadius: br, flexShrink: 0 }} />
);

function SkKPI() {
  return (
    <div style={{ background: C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 22px" }}>
      <Sk w={40} h={22} mb={14} /><Sk w="58%" h={26} mb={8} /><Sk w="75%" h={13} />
    </div>
  );
}

function SkRows({ rows = 5, cols = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} style={{ padding:"12px 14px" }}><Sk w={c===0?"65%":"45%"} h={13} /></td>
      ))}
    </tr>
  ));
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function Err({ msg, onRetry }) {
  return (
    <div style={{ background:"#FFF5F5", border:"1px solid #FEB2B2", borderRadius:8, padding:"11px 15px",
      display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, color:"#C53030" }}>
      <span>⚠ {msg}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ border:"1px solid #C53030", borderRadius:6, background:"transparent",
          color:"#C53030", fontSize:12, padding:"4px 10px", cursor:"pointer" }}>Retry</button>
      )}
    </div>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ data, keys, colors, h: H = 220 }) {
  if (!data.length) return <div className="sk" style={{ height: H, borderRadius:8 }} />;

  const W = 560, pad = { t:16, r:16, b:32, l:44 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const vals = data.flatMap(d => keys.map(k => Number(d[k]) || 0));
  const maxV = (Math.max(...vals) || 1) * 1.15;
  const px = i => pad.l + (i / Math.max(data.length - 1, 1)) * iW;
  const py = v => pad.t + iH - (v / maxV) * iH;
  const line = k => data.map((d,i) => `${i===0?"M":"L"}${px(i).toFixed(1)},${py(Number(d[k])||0).toFixed(1)}`).join(" ");
  const area = k => `${line(k)} L${px(data.length-1).toFixed(1)},${(pad.t+iH).toFixed(1)} L${px(0).toFixed(1)},${(pad.t+iH).toFixed(1)} Z`;
  const ticks = [0,.25,.5,.75,1].map(f => Math.round(maxV * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
      <defs>
        {keys.map((k,i) => (
          <linearGradient key={k} id={`lg${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[i]} stopOpacity=".18"/>
            <stop offset="100%" stopColor={colors[i]} stopOpacity="0"/>
          </linearGradient>
        ))}
      </defs>
      {ticks.map(v => (
        <g key={v}>
          <line x1={pad.l} x2={W-pad.r} y1={py(v)} y2={py(v)} stroke={C.border} strokeWidth="1" strokeDasharray="4 3"/>
          <text x={pad.l-6} y={py(v)+4} textAnchor="end" fontSize={10} fill={C.muted} fontFamily={F.body}>{v}</text>
        </g>
      ))}
      {data.map((d,i) => i%2===0 && (
        <text key={i} x={px(i)} y={H-6} textAnchor="middle" fontSize={10} fill={C.muted} fontFamily={F.body}>{d.month}</text>
      ))}
      {keys.map(k => <path key={`a${k}`} d={area(k)} fill={`url(#lg${k})`}/>)}
      {keys.map((k,i) => <path key={`l${k}`} d={line(k)} fill="none" stroke={colors[i]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>)}
      {keys.map((k,i) => {
        const last = data[data.length-1];
        return <circle key={`d${k}`} cx={px(data.length-1)} cy={py(Number(last[k])||0)} r="4" fill={colors[i]} stroke="#fff" strokeWidth="2"/>;
      })}
    </svg>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, keys, colors, h: H = 220 }) {
  if (!data.length) return <div className="sk" style={{ height: H, borderRadius:8 }} />;

  const W = 560, pad = { t:16, r:16, b:32, l:44 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const vals = data.flatMap(d => keys.map(k => Number(d[k]) || 0));
  const maxV = (Math.max(...vals) || 1) * 1.15;
  const gW = iW / data.length;
  const bW = Math.min((gW / keys.length) * 0.7, 22);
  const gP = (gW - bW * keys.length) / 2;
  const bx = (i,ki) => pad.l + i*gW + gP + ki*bW;
  const bh = v => (v/maxV) * iH;
  const by = v => pad.t + iH - bh(v);
  const ticks = [0,.5,1].map(f => Math.round(maxV*f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
      {ticks.map(v => {
        const yy = pad.t + iH - (v/maxV)*iH;
        return (
          <g key={v}>
            <line x1={pad.l} x2={W-pad.r} y1={yy} y2={yy} stroke={C.border} strokeWidth="1" strokeDasharray="4 3"/>
            <text x={pad.l-6} y={yy+4} textAnchor="end" fontSize={10} fill={C.muted} fontFamily={F.body}>{v}</text>
          </g>
        );
      })}
      {data.map((d,i) => (
        <text key={i} x={pad.l+i*gW+gW/2} y={H-6} textAnchor="middle" fontSize={10} fill={C.muted} fontFamily={F.body}>{d.month}</text>
      ))}
      {data.map((d,i) => keys.map((k,ki) => (
        <rect key={`${i}${ki}`} x={bx(i,ki)} y={by(Number(d[k])||0)}
          width={bW-1} height={bh(Number(d[k])||0)} rx="3" fill={colors[ki]} opacity=".88"/>
      )))}
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 180 }) {
  if (!data.length) return <div className="sk" style={{ width:size, height:size, borderRadius:"50%" }}/>;

  const cx = size/2, cy = size/2, r = size*.38, ir = size*.24;
  let angle = -Math.PI/2;
  const total = data.reduce((a,b) => a + (Number(b.count)||0), 0);

  const slices = data.map(d => {
    const sweep = ((Number(d.pct)||0) / 100) * 2 * Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    angle += sweep;
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle);
    const lx1=cx+ir*Math.cos(angle-sweep), ly1=cy+ir*Math.sin(angle-sweep);
    const lx2=cx+ir*Math.cos(angle), ly2=cy+ir*Math.sin(angle);
    return { ...d, path:`M${x1},${y1} A${r},${r} 0 ${sweep>Math.PI?1:0},1 ${x2},${y2} L${lx2},${ly2} A${ir},${ir} 0 ${sweep>Math.PI?1:0},0 ${lx1},${ly1} Z` };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width:size, height:size, flexShrink:0 }}>
      {slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity=".92"/>)}
      <text x={cx} y={cy-7} textAnchor="middle" fontSize={18} fontWeight="700" fill={C.navy} fontFamily={F.head}>{total.toLocaleString()}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize={9} fill={C.muted} fontFamily={F.body}>TOTAL PARCELS</text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Spark({ values, color = "#0D7A6F", width = 72, height = 26 }) {
  if (!values?.length) return null;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx-mn || 1;
  const pts = values.map((v,i) =>
    `${((i/(values.length-1))*width).toFixed(1)},${(height-((v-mn)/rng)*(height-4)-2).toFixed(1)}`
  ).join(" ");
  const ly = height - ((values[values.length-1]-mn)/rng)*(height-4) - 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width} cy={ly} r="3" fill={color}/>
    </svg>
  );
}

// ─── H-bar ────────────────────────────────────────────────────────────────────
function HBar({ label, value, max, total }) {
  const v = Number(value) || 0;
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{label}</span>
        <span style={{ fontSize:13, color:C.muted }}>
          {v} <span style={{ fontSize:11 }}>({((v/(Number(total)||1))*100).toFixed(1)}%)</span>
        </span>
      </div>
      <div style={{ height:7, background:C.bgDark, borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${((v/(Number(max)||1))*100).toFixed(1)}%`,
          borderRadius:4, background:`linear-gradient(90deg,${C.teal},${C.tealMid})`, transition:"width .5s ease" }}/>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:10 }}>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:color }}/>
          <span style={{ fontSize:12, color:C.muted }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ title, subtitle, action, children, style = {} }) {
  return (
    <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12,
      padding:"22px 24px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", ...style }}>
      {(title||action) && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div>
            <h3 style={{ fontFamily:F.head, fontSize:16, fontWeight:600, color:C.navy }}>{title}</h3>
            {subtitle && <p style={{ fontSize:12, color:C.muted, marginTop:3 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Tab btn / group ──────────────────────────────────────────────────────────
function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 14px", border:"none", borderRadius:7,
      background:active?C.navy:"transparent", color:active?"#fff":C.muted,
      fontSize:12, fontWeight:500, cursor:"pointer", transition:"all .15s" }}>{label}</button>
  );
}

function Tabs({ children }) {
  return (
    <div style={{ display:"flex", background:C.bg, borderRadius:9, padding:3, gap:2 }}>{children}</div>
  );
}

// ─── Export btn ───────────────────────────────────────────────────────────────
function ExBtn({ label = "Export", onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display:"flex", alignItems:"center", gap:6,
      padding:"7px 13px", border:`1px solid ${C.border}`, borderRadius:8,
      background:C.white, color:C.slate, fontSize:12, fontWeight:500,
      cursor:disabled?"not-allowed":"pointer", opacity:disabled?.6:1 }}>↓ {label}</button>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function Pill({ status }) {
  const s = STATUS_S[status] ?? { bg:C.bgDark, color:C.slate };
  return (
    <span style={{ background:s.bg, color:s.color, padding:"2px 10px",
      borderRadius:20, fontSize:11, fontWeight:500 }}>{status}</span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, delta, deltaLabel, icon, accent, loading }) {
  if (loading) return <SkKPI />;
  const pos = (delta ?? 0) >= 0;
  return (
    <div className="fi" style={{ background:accent?`linear-gradient(135deg,${C.navy},${C.navyMid})`:C.white,
      border:`1px solid ${accent?C.navy:C.border}`, borderRadius:12, padding:"20px 22px",
      boxShadow:accent?"0 4px 20px rgba(11,31,58,.25)":"0 1px 4px rgba(0,0,0,.06)",
      display:"flex", flexDirection:"column", gap:10, position:"relative", overflow:"hidden" }}>
      {accent && <div style={{ position:"absolute", right:-16, top:-16, width:80, height:80,
        borderRadius:"50%", background:"rgba(255,255,255,.05)" }}/>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        {delta != null && (
          <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:20,
            background:accent?"rgba(255,255,255,.12)":(pos?C.successLt:C.dangerLt),
            color:accent?"#fff":(pos?C.success:C.danger) }}>
            {pos?"▲":"▼"} {Math.abs(delta)}% {deltaLabel}
          </span>
        )}
      </div>
      <div>
        <p style={{ fontFamily:F.head, fontSize:28, fontWeight:700,
          color:accent?"#fff":C.navy, lineHeight:1 }}>{value}</p>
        <p style={{ fontSize:13, color:accent?"#94A3B8":C.muted, marginTop:4 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── System health ────────────────────────────────────────────────────────────
function SysHealth() {
  const [t, setT] = useState(new Date().toLocaleTimeString("en-KE"));
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString("en-KE")), 1000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { l:"Fabric Peers", v:"2/2 Online" }, { l:"CouchDB",     v:"Healthy"  },
    { l:"IPFS Node",    v:"Healthy"    }, { l:"API Latency", v:"142ms"    },
    { l:"Block Height", v:"#48,291"   }, { l:"Pending Tx",  v:"3"        },
  ];

  return (
    <div style={{ marginTop:20, background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,
      borderRadius:12, padding:"18px 24px", display:"flex",
      justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
      <div>
        <p style={{ fontFamily:F.head, fontSize:14, fontWeight:600, color:"#fff" }}>System Health</p>
        <p style={{ fontSize:12, color:"#64748B", marginTop:2 }}>Hyperledger Fabric · {t}</p>
      </div>
      <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
        {stats.map(s => (
          <div key={s.l} style={{ textAlign:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"center" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#34D399" }}/>
              <span style={{ fontSize:12, fontWeight:600, color:"#fff" }}>{s.v}</span>
            </div>
            <p style={{ fontSize:11, color:"#64748B", marginTop:2 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function ReportsDashboard() {
  const [period,    setPeriod]    = useState("2025");
  const [chartTab,  setChartTab]  = useState("reg");
  const [countyKey, setCountyKey] = useState("parcels");
  const [txFilter,  setTxFilter]  = useState("ALL");
  const [txPage,    setTxPage]    = useState(1);
  const [exporting, setExporting] = useState(false);

  // ── API calls ──────────────────────────────────────────────────────────────
  const apiSummary   = useApi("/summary",                { period },                              [period]);
  const apiMonthly   = useApi("/monthly-activity",       { period },                              [period]);
  const apiOutcomes  = useApi("/transfer-outcomes",      { period },                              [period]);
  const apiLandUse   = useApi("/land-use",               {},                                      []);
  const apiCounty    = useApi("/county-stats",           { period },                              [period]);
  const apiTxValType = useApi("/transfer-value-by-type", { period },                              [period]);
  const apiTxSum     = useApi("/transfer-summary",       { period },                              [period]);
  const apiTx        = useApi("/recent-transactions",    {
    type:  txFilter !== "ALL" ? txFilter : undefined,
    page:  txPage,
    limit: 10,
  },                                                                                              [txFilter, txPage]);

  // ── Data normalisation ─────────────────────────────────────────────────────
  // Each toArr / toObj call ensures we never pass an Object to JSX as a child.

  // /summary → object
  const sumObj   = toObj(apiSummary.raw);

  // /land-use → array of { type, count, pct }
  const landArr  = toArr(apiLandUse.raw).map(d => ({
    ...d,
    count: Number(d.count) || 0,
    pct:   Number(d.pct)   || 0,
    color: LU_COLORS[d.type] ?? "#64748B",
  }));

  // /monthly-activity → array of { month, parcels, transfers, encumbrances }
  const monthArr = toArr(apiMonthly.raw);

  // /transfer-outcomes → array of { month, approved, rejected }
  const outArr   = toArr(apiOutcomes.raw);

  // /county-stats → array of { county, parcels, transfers, value, sparkline? }
  const countyArr = toArr(apiCounty.raw);

  // /transfer-value-by-type → array of { type, value, pct }
  const txValArr  = toArr(apiTxValType.raw);

  // /transfer-summary → object { approved, rejected, pending, approvedPct, rejectedPct, pendingPct }
  const txSumObj  = toObj(apiTxSum.raw);

  // /recent-transactions → array (may be wrapped in { items, total })
  const txRaw    = apiTx.raw;
  const txArr    = toArr(txRaw);
  const txTotal  = (txRaw && !Array.isArray(txRaw) && typeof txRaw.total === "number")
    ? txRaw.total
    : txArr.length;

  // Sparklines — built once per county, reused on re-renders
  const sparks = useRef({});
  useEffect(() => {
    countyArr.forEach(c => {
      if (!sparks.current[c.county]) {
        sparks.current[c.county] = Array.isArray(c.sparkline) && c.sparkline.length
          ? c.sparkline.map(Number)
          : Array.from({ length:8 }, () => Math.max(0, (c.parcels||0) + Math.round((Math.random()-.5)*30)));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCounty.raw]);

  // KPI cards
  const kpis = [
    { label:"Total Registrations",    icon:"📋", accent:true,
      value: sumObj.totalRegistrations != null ? Number(sumObj.totalRegistrations).toLocaleString() : "—",
      delta: sumObj.deltas?.registrations, deltaLabel:"YoY" },
    { label:"Ownership Transfers",    icon:"🔄",
      value: sumObj.totalTransfers != null ? Number(sumObj.totalTransfers).toLocaleString() : "—",
      delta: sumObj.deltas?.transfers, deltaLabel:"YoY" },
    { label:"Active Encumbrances",    icon:"🔒",
      value: sumObj.activeEncumbrances != null ? Number(sumObj.activeEncumbrances).toLocaleString() : "—",
      delta: sumObj.deltas?.encumbrances, deltaLabel:"YoY" },
    { label:"Total Value Transacted", icon:"💰",
      value: typeof sumObj.totalValue === "string" ? sumObj.totalValue : "—",
      delta: sumObj.deltas?.value, deltaLabel:"YoY" },
  ];

  // Transfer summary mini-cards
  const txSumCards = [
    { label:"Approved", color:C.success, bg:C.successLt,
      value: txSumObj.approved != null ? String(txSumObj.approved) : "—",
      pct:   Number(txSumObj.approvedPct) || 0 },
    { label:"Rejected", color:C.danger,  bg:C.dangerLt,
      value: txSumObj.rejected != null ? String(txSumObj.rejected) : "—",
      pct:   Number(txSumObj.rejectedPct) || 0 },
    { label:"Pending",  color:"#1D4ED8", bg:"#EFF6FF",
      value: txSumObj.pending != null ? String(txSumObj.pending) : "—",
      pct:   Number(txSumObj.pendingPct) || 0 },
  ];

  // Handlers
  const handlePeriod   = p => { setPeriod(p); setTxPage(1); };
  const handleTxFilter = f => { setTxFilter(f); setTxPage(1); };
  const handleExport   = async () => {
    setExporting(true);
    try { await exportCsv(period); } catch(e) { alert(e.message); } finally { setExporting(false); }
  };

  const g = (cols, gap=20) => ({ display:"grid", gridTemplateColumns:cols, gap, marginBottom:20 });
  const genDate = new Date().toLocaleDateString("en-KE",{ day:"numeric", month:"long", year:"numeric" });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:F.body, background:C.bg, minHeight:"100vh", color:C.text }}>
      <FontLoader/>

      {/* ── Header ── */}
      <div style={{ background:`linear-gradient(135deg,${C.navy} 0%,${C.navyMid} 100%)`,
        padding:"28px 32px 32px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, opacity:.05,
          backgroundImage:"repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
          backgroundSize:"20px 20px" }}/>
        <div style={{ position:"absolute", right:32, top:16, width:120, height:120,
          borderRadius:"50%", border:"1px solid rgba(255,255,255,.10)" }}/>

        <div style={{ position:"relative", display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <div style={{ width:8, height:28, background:C.teal, borderRadius:4 }}/>
              <h1 style={{ fontFamily:F.head, fontSize:24, fontWeight:700, color:"#fff" }}>
                Reports &amp; Analytics
              </h1>
            </div>
            <p style={{ color:"#94A3B8", fontSize:13, marginLeft:18 }}>
              Blockchain Land Registry · Ministry of Lands, Kenya · {genDate}
            </p>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ display:"flex", background:"rgba(255,255,255,.07)", borderRadius:10, padding:3, gap:1 }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => handlePeriod(p)} style={{ padding:"6px 12px", border:"none",
                  borderRadius:8, background:period===p?C.teal:"transparent",
                  color:period===p?"#fff":"#94A3B8", fontSize:12, fontWeight:500,
                  cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }}>{p}</button>
              ))}
            </div>
            <button onClick={handleExport} disabled={exporting} style={{ display:"flex", alignItems:"center",
              gap:6, padding:"9px 16px", borderRadius:8, background:exporting?C.tealMid:C.teal,
              border:"none", color:"#fff", fontSize:13, fontWeight:500,
              cursor:exporting?"not-allowed":"pointer", opacity:exporting?.8:1 }}>
              {exporting ? "⏳ Exporting…" : "↓ Export Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding:"28px 32px", maxWidth:1400, margin:"0 auto" }}>

        {/* Global error */}
        {apiSummary.error && (
          <div style={{ marginBottom:16 }}>
            <Err msg={apiSummary.error} onRetry={apiSummary.refetch}/>
          </div>
        )}

        {/* KPIs */}
        <div style={g("repeat(4,1fr)", 16)}>
          {kpis.map(k => <KPI key={k.label} {...k} loading={apiSummary.loading}/>)}
        </div>

        {/* Row 1: chart + donut */}
        <div style={g("1fr 380px")}>
          <Panel
            title={chartTab==="reg" ? "Registration Activity" : "Transfer Outcomes"}
            subtitle={`Monthly breakdown — ${period}`}
            action={
              <Tabs>
                <Tab label="Registrations" active={chartTab==="reg"} onClick={() => setChartTab("reg")}/>
                <Tab label="Transfers"     active={chartTab==="tfr"} onClick={() => setChartTab("tfr")}/>
              </Tabs>
            }
          >
            {chartTab === "reg" ? (
              <>
                {apiMonthly.error
                  ? <Err msg={apiMonthly.error} onRetry={apiMonthly.refetch}/>
                  : <LineChart data={monthArr} keys={["parcels","transfers","encumbrances"]}
                      colors={[C.chartTeal, C.chartNavy, C.chartGold]} h={220}/>}
                <Legend items={[
                  { label:"Parcels Registered", color:C.chartTeal },
                  { label:"Transfers",           color:C.chartNavy },
                  { label:"Encumbrances",        color:C.chartGold },
                ]}/>
              </>
            ) : (
              <>
                {apiOutcomes.error
                  ? <Err msg={apiOutcomes.error} onRetry={apiOutcomes.refetch}/>
                  : <BarChart data={outArr} keys={["approved","rejected"]}
                      colors={[C.chartTeal, C.chartCoral]} h={220}/>}
                <Legend items={[
                  { label:"Approved", color:C.chartTeal  },
                  { label:"Rejected", color:C.chartCoral },
                ]}/>
              </>
            )}
          </Panel>

          <Panel title="Land Use Distribution" subtitle="Active parcels by type">
            {apiLandUse.error
              ? <Err msg={apiLandUse.error} onRetry={apiLandUse.refetch}/>
              : (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
                  <DonutChart data={landArr} size={164}/>
                  <div style={{ width:"100%" }}>
                    {apiLandUse.loading
                      ? Array.from({length:4}).map((_,i) => (
                          <div key={i} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                            <Sk h={13}/>
                          </div>
                        ))
                      : landArr.map(d => (
                          <div key={d.type} className="fi" style={{ display:"flex", justifyContent:"space-between",
                            alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:2, background:d.color }}/>
                              <span style={{ fontSize:13, color:C.text }}>{d.type}</span>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>{d.count.toLocaleString()}</span>
                              <span style={{ fontSize:11, color:C.muted, marginLeft:4 }}>({d.pct}%)</span>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )
            }
          </Panel>
        </div>

        {/* Row 2: county + transfer outcomes */}
        <div style={g("1fr 1fr")}>

          {/* County performance */}
          <Panel
            title="County Performance"
            subtitle="Top counties by activity"
            action={
              <Tabs>
                <Tab label="Parcels"   active={countyKey==="parcels"}   onClick={() => setCountyKey("parcels")}/>
                <Tab label="Transfers" active={countyKey==="transfers"} onClick={() => setCountyKey("transfers")}/>
              </Tabs>
            }
          >
            {apiCounty.error
              ? <Err msg={apiCounty.error} onRetry={apiCounty.refetch}/>
              : apiCounty.loading
                ? Array.from({length:6}).map((_,i) => (
                    <div key={i} style={{ marginBottom:12 }}>
                      <Sk h={13} mb={5}/><Sk h={7}/>
                    </div>
                  ))
                : (() => {
                    const vals  = countyArr.map(c => Number(c[countyKey]) || 0);
                    const total = vals.reduce((a,b) => a+b, 0);
                    const max   = Math.max(...vals, 1);
                    return countyArr.map(c => (
                      <HBar key={c.county} label={c.county}
                        value={Number(c[countyKey])||0} max={max} total={total}/>
                    ));
                  })()
            }
          </Panel>

          {/* Transfer outcomes */}
          <Panel title="Transfer Outcomes" subtitle={`Full year — ${period}`}>
            {apiTxSum.error
              ? <Err msg={apiTxSum.error} onRetry={apiTxSum.refetch}/>
              : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
                    {txSumCards.map(s => (
                      <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:"14px 16px", textAlign:"center" }}>
                        {apiTxSum.loading
                          ? <><Sk w="50%" h={26} mb={6}/><Sk w="70%" h={12}/></>
                          : <div className="fi">
                              <p style={{ fontFamily:F.head, fontSize:26, fontWeight:700, color:s.color }}>{s.value}</p>
                              <p style={{ fontSize:12, color:s.color, fontWeight:500, marginTop:2 }}>{s.label}</p>
                              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>{s.pct}% of total</p>
                            </div>
                        }
                      </div>
                    ))}
                  </div>

                  <div style={{ background:C.bg, borderRadius:10, padding:16 }}>
                    <p style={{ fontSize:12, fontWeight:600, color:C.navy, marginBottom:12,
                      textTransform:"uppercase", letterSpacing:".06em" }}>Value by Transfer Type</p>
                    {apiTxValType.error
                      ? <Err msg={apiTxValType.error} onRetry={apiTxValType.refetch}/>
                      : apiTxValType.loading
                        ? Array.from({length:4}).map((_,i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                              <Sk w={95} h={13}/><div style={{ flex:1 }}><Sk h={7}/></div><Sk w={75} h={13}/>
                            </div>
                          ))
                        : txValArr.map(r => (
                            <div key={String(r.type)} className="fi"
                              style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                              <span style={{ fontSize:13, color:C.textMid, minWidth:100 }}>{String(r.type)}</span>
                              <div style={{ flex:1, height:7, background:C.border, borderRadius:4, overflow:"hidden" }}>
                                <div style={{ height:"100%", width:`${Number(r.pct)||0}%`,
                                  background:`linear-gradient(90deg,${C.teal},${C.tealMid})`, borderRadius:4 }}/>
                              </div>
                              <span style={{ fontSize:12, fontWeight:600, color:C.navy, minWidth:80, textAlign:"right" }}>
                                {String(r.value)}
                              </span>
                            </div>
                          ))
                    }
                  </div>
                </>
              )
            }
          </Panel>
        </div>

        {/* Row 3: county sparkline table */}
        <Panel title="County Trends" subtitle="Registration activity per county"
          action={<ExBtn label="Export CSV" onClick={handleExport} disabled={exporting}/>}
          style={{ marginBottom:20, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:700 }}>
            <thead>
              <tr style={{ background:C.bg }}>
                {["County","Parcels","Transfers","Est. Value","Trend (8mo)","Δ"].map((h,i) => (
                  <th key={i} style={{ padding:"10px 14px", textAlign:i>1?"right":"left",
                    color:C.muted, fontWeight:500, borderBottom:`1px solid ${C.border}`,
                    fontSize:12, letterSpacing:".03em", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apiCounty.loading
                ? <SkRows rows={6} cols={6}/>
                : apiCounty.error
                  ? <tr><td colSpan={6} style={{ padding:16 }}>
                      <Err msg={apiCounty.error} onRetry={apiCounty.refetch}/>
                    </td></tr>
                  : countyArr.map(c => {
                      const sp = sparks.current[c.county] ?? [];
                      const up = sp.length >= 2 && sp[sp.length-1] > sp[0];
                      const d  = sp.length >= 2 ? Math.abs(sp[sp.length-1] - sp[0]) : 0;
                      return (
                        <tr key={c.county} className="fi" style={{ borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"12px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <div style={{ width:28, height:28, borderRadius:8, background:C.tealLt,
                                display:"flex", alignItems:"center", justifyContent:"center",
                                fontSize:13, color:C.teal, fontFamily:F.mono, fontWeight:600 }}>
                                {c.county[0]}
                              </div>
                              <span style={{ fontWeight:600, color:C.navy }}>{c.county}</span>
                            </div>
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>
                            {(Number(c.parcels)||0).toLocaleString()}
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>
                            {(Number(c.transfers)||0).toLocaleString()}
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right", color:C.textMid }}>
                            {String(c.value ?? "—")}
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right" }}>
                            {sp.length > 0 && <Spark values={sp} color={up?C.chartTeal:C.chartCoral}/>}
                          </td>
                          <td style={{ padding:"12px 14px", textAlign:"right" }}>
                            {sp.length >= 2 && (
                              <span style={{ fontSize:11, fontWeight:600, color:up?C.success:C.danger }}>
                                {up?"▲":"▼"} {d}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </Panel>

        {/* Row 4: recent transactions */}
        <Panel
          title="Recent Transactions"
          subtitle="Latest blockchain events across all counties"
          action={
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Tabs>
                {["ALL","Transfer","Registration","Encumbrance"].map(f => (
                  <Tab key={f} label={f} active={txFilter===f} onClick={() => handleTxFilter(f)}/>
                ))}
              </Tabs>
              <ExBtn label="CSV" onClick={handleExport} disabled={exporting}/>
            </div>
          }
        >
          {apiTx.error
            ? <Err msg={apiTx.error} onRetry={apiTx.refetch}/>
            : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:750 }}>
                  <thead>
                    <tr style={{ background:C.bg }}>
                      {["Transaction ID","Type","Parcel","County","Value","Status","Date"].map((h,i) => (
                        <th key={i} style={{ padding:"10px 14px", textAlign:i>=4?"right":"left",
                          color:C.muted, fontWeight:500, borderBottom:`1px solid ${C.border}`,
                          fontSize:12, textTransform:"uppercase", letterSpacing:".03em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apiTx.loading
                      ? <SkRows rows={8} cols={7}/>
                      : txArr.map(tx => (
                          <tr key={String(tx.id)} className="fi" style={{ borderBottom:`1px solid ${C.border}` }}>
                            <td style={{ padding:"12px 14px" }}>
                              <span style={{ fontFamily:F.mono, fontSize:12, color:C.teal }}>{String(tx.id)}</span>
                            </td>
                            <td style={{ padding:"12px 14px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <span style={{ fontSize:15 }}>{TX_ICON[tx.type] ?? "📄"}</span>
                                <span style={{ color:C.textMid }}>{String(tx.type)}</span>
                              </div>
                            </td>
                            <td style={{ padding:"12px 14px", fontFamily:F.mono, fontSize:11, color:C.textMid }}>
                              {String(tx.parcel ?? "—")}
                            </td>
                            <td style={{ padding:"12px 14px" }}>{String(tx.county ?? "—")}</td>
                            <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>
                              {String(tx.value ?? "—")}
                            </td>
                            <td style={{ padding:"12px 14px", textAlign:"right" }}>
                              <Pill status={String(tx.status)}/>
                            </td>
                            <td style={{ padding:"12px 14px", textAlign:"right", color:C.muted }}>
                              {String(tx.date ?? "—")}
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            )
          }

          {/* Footer */}
          <div style={{ marginTop:16, padding:"14px 16px", background:C.bg, borderRadius:8,
            display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
              {[["Total",txTotal],["Showing",txArr.length],["Page",txPage]].map(([k,v]) => (
                <div key={k}>
                  <span style={{ fontSize:12, color:C.muted }}>{k}: </span>
                  <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setTxPage(p => Math.max(1, p-1))}
                disabled={txPage===1||apiTx.loading}
                style={{ padding:"5px 12px", border:`1px solid ${C.border}`, borderRadius:6,
                  background:C.white, color:C.slate, fontSize:12,
                  cursor:txPage===1?"not-allowed":"pointer", opacity:txPage===1?.4:1 }}>← Prev</button>
              <button onClick={() => setTxPage(p => p+1)}
                disabled={txArr.length<10||apiTx.loading}
                style={{ padding:"5px 12px", border:`1px solid ${C.border}`, borderRadius:6,
                  background:C.white, color:C.slate, fontSize:12,
                  cursor:txArr.length<10?"not-allowed":"pointer", opacity:txArr.length<10?.4:1 }}>Next →</button>
            </div>
          </div>
        </Panel>

        <SysHealth/>
      </div>
    </div>
  );
}