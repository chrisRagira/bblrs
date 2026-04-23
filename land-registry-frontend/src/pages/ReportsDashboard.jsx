import { useState, useEffect, useRef } from "react";

// ─── Design tokens (inline – matches existing BBLRS tokens.js) ─────────────
const T = {
  navy:     "#0B1F3A",
  navyMid:  "#1A3558",
  navyLt:   "#243C5F",
  teal:     "#0D7A6F",
  tealLt:   "#E0F2F0",
  tealMid:  "#0FA896",
  gold:     "#C28A1A",
  goldLt:   "#FBF3DC",
  slate:    "#4A5568",
  border:   "#E2E8F0",
  bg:       "#F7F9FC",
  bgDark:   "#EEF2F7",
  white:    "#FFFFFF",
  danger:   "#C53030",
  dangerLt: "#FFF5F5",
  success:  "#276749",
  successLt:"#F0FFF4",
  warn:     "#92400E",
  warnLt:   "#FFFBEB",
  text:     "#1A202C",
  textMid:  "#4A5568",
  textMuted:"#718096",
  chart: {
    teal:   "#0D7A6F",
    navy:   "#1A3558",
    gold:   "#C28A1A",
    coral:  "#E05C3A",
    slate:  "#64748B",
    mint:   "#10B981",
    purple: "#7C3AED",
    amber:  "#F59E0B",
  },
};

const font = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Mock data ──────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const REGISTRATION_DATA = [
  { month:"Jan", parcels:42, transfers:18, encumbrances:9  },
  { month:"Feb", parcels:58, transfers:24, encumbrances:12 },
  { month:"Mar", parcels:71, transfers:31, encumbrances:8  },
  { month:"Apr", parcels:65, transfers:27, encumbrances:15 },
  { month:"May", parcels:89, transfers:45, encumbrances:20 },
  { month:"Jun", parcels:94, transfers:52, encumbrances:17 },
  { month:"Jul", parcels:78, transfers:39, encumbrances:11 },
  { month:"Aug", parcels:103,transfers:61, encumbrances:24 },
  { month:"Sep", parcels:117,transfers:58, encumbrances:19 },
  { month:"Oct", parcels:98, transfers:48, encumbrances:22 },
  { month:"Nov", parcels:112,transfers:67, encumbrances:28 },
  { month:"Dec", parcels:134,transfers:74, encumbrances:31 },
];

const LAND_USE_DATA = [
  { type:"Residential",  count:487, pct:42, color:T.chart.teal   },
  { type:"Agricultural", count:321, pct:28, color:T.chart.gold   },
  { type:"Commercial",   count:195, pct:17, color:T.chart.navy   },
  { type:"Industrial",   count:149, pct:13, color:T.chart.coral  },
];

const COUNTY_DATA = [
  { county:"Nairobi",    parcels:234, transfers:89, value:"KES 4.2B" },
  { county:"Nakuru",     parcels:187, transfers:64, value:"KES 1.8B" },
  { county:"Mombasa",    parcels:156, transfers:51, value:"KES 3.1B" },
  { county:"Kisumu",     parcels:129, transfers:43, value:"KES 0.9B" },
  { county:"Kiambu",     parcels:118, transfers:38, value:"KES 2.7B" },
  { county:"Machakos",   parcels:97,  transfers:29, value:"KES 0.6B" },
  { county:"Eldoret",    parcels:88,  transfers:25, value:"KES 0.7B" },
  { county:"Nyeri",      parcels:72,  transfers:20, value:"KES 0.5B" },
];

const TRANSFER_TREND = [
  { month:"Jan", approved:14, rejected:4,  pending:0  },
  { month:"Feb", approved:19, rejected:5,  pending:0  },
  { month:"Mar", approved:26, rejected:5,  pending:0  },
  { month:"Apr", approved:22, rejected:5,  pending:0  },
  { month:"May", approved:38, rejected:7,  pending:0  },
  { month:"Jun", approved:44, rejected:8,  pending:0  },
  { month:"Jul", approved:31, rejected:8,  pending:0  },
  { month:"Aug", approved:52, rejected:9,  pending:0  },
  { month:"Sep", approved:49, rejected:9,  pending:0  },
  { month:"Oct", approved:40, rejected:8,  pending:0  },
  { month:"Nov", approved:57, rejected:10, pending:0  },
  { month:"Dec", approved:63, rejected:11, pending:3  },
];

const RECENT_TRANSACTIONS = [
  { id:"TX-2025-1201", type:"Transfer",    parcel:"KE/NAI/2024/0891", county:"Nairobi",  value:"KES 12,400,000", status:"APPROVED", date:"2025-04-11" },
  { id:"TX-2025-1200", type:"Registration",parcel:"KE/NKR/2025/0134", county:"Nakuru",   value:"—",              status:"APPROVED", date:"2025-04-11" },
  { id:"TX-2025-1199", type:"Encumbrance", parcel:"KE/MOM/2023/0045", county:"Mombasa",  value:"KES 4,500,000",  status:"ACTIVE",   date:"2025-04-10" },
  { id:"TX-2025-1198", type:"Transfer",    parcel:"KE/KSM/2022/0099", county:"Kisumu",   value:"KES 2,200,000",  status:"REJECTED", date:"2025-04-10" },
  { id:"TX-2025-1197", type:"Transfer",    parcel:"KE/KIA/2024/0312", county:"Kiambu",   value:"KES 8,750,000",  status:"PENDING",  date:"2025-04-09" },
  { id:"TX-2025-1196", type:"Registration",parcel:"KE/ELD/2025/0088", county:"Eldoret",  value:"—",              status:"APPROVED", date:"2025-04-09" },
  { id:"TX-2025-1195", type:"Discharge",   parcel:"KE/NAI/2023/0671", county:"Nairobi",  value:"KES 6,100,000",  status:"APPROVED", date:"2025-04-08" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  APPROVED: { bg:"#F0FFF4", color:"#276749" },
  REJECTED: { bg:"#FFF5F5", color:"#C53030" },
  PENDING:  { bg:"#EFF6FF", color:"#1D4ED8" },
  ACTIVE:   { bg:T.tealLt,  color:T.teal    },
};

const TYPE_ICON = {
  Transfer:    "🔄",
  Registration:"📋",
  Encumbrance: "🔒",
  Discharge:   "🔓",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({ label, value, delta, deltaLabel, icon, accent = false }) {
  const positive = delta > 0;
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)` : T.white,
      border: `1px solid ${accent ? T.navy : T.border}`,
      borderRadius: 12, padding: "20px 22px",
      boxShadow: accent ? "0 4px 20px rgba(11,31,58,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
    }}>
      {accent && (
        <div style={{
          position:"absolute", right:-16, top:-16,
          width:80, height:80, borderRadius:"50%",
          background:"rgba(255,255,255,0.05)",
        }} />
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        {delta !== undefined && (
          <span style={{
            fontSize: 12, fontWeight: 500, padding: "2px 8px",
            borderRadius: 20,
            background: accent ? "rgba(255,255,255,0.12)" : (positive ? T.successLt : T.dangerLt),
            color: accent ? "#fff" : (positive ? T.success : T.danger),
          }}>
            {positive ? "▲" : "▼"} {Math.abs(delta)}% {deltaLabel}
          </span>
        )}
      </div>
      <div>
        <p style={{
          fontFamily: font.head, fontSize: 28, fontWeight: 700,
          color: accent ? "#fff" : T.navy, lineHeight: 1,
        }}>{value}</p>
        <p style={{ fontSize: 13, color: accent ? "#94A3B8" : T.textMuted, marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}

// SVG line chart
function LineChart({ data, keys, colors, height = 200 }) {
  const w = 560, h = height, pad = { top:16, right:16, bottom:32, left:40 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top  - pad.bottom;

  const allVals = data.flatMap(d => keys.map(k => d[k]));
  const maxV = Math.max(...allVals) * 1.15;

  const x  = (i) => pad.left + (i / (data.length - 1)) * innerW;
  const y  = (v) => pad.top  + innerH - (v / maxV) * innerH;

  const path = (key) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const area = (key) =>
    `${path(key)} L${x(data.length-1).toFixed(1)},${(pad.top+innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top+innerH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxV * f));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%", height:"auto" }}>
      <defs>
        {keys.map((k, i) => (
          <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors[i]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colors[i]} stopOpacity="0"    />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={pad.left} x2={w - pad.right} y1={y(v)} y2={y(v)}
            stroke={T.border} strokeWidth="1" strokeDasharray="4 3" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end"
            fontSize={10} fill={T.textMuted} fontFamily={font.body}>{v}</text>
        </g>
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        i % 2 === 0 && (
          <text key={i} x={x(i)} y={h - 6} textAnchor="middle"
            fontSize={10} fill={T.textMuted} fontFamily={font.body}>{d.month}</text>
        )
      ))}

      {/* Area fills */}
      {keys.map((k, i) => (
        <path key={`area-${k}`} d={area(k)} fill={`url(#grad-${k})`} />
      ))}

      {/* Lines */}
      {keys.map((k, i) => (
        <path key={`line-${k}`} d={path(k)}
          fill="none" stroke={colors[i]} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* Dots on last point */}
      {keys.map((k, i) => {
        const last = data[data.length - 1];
        return (
          <circle key={`dot-${k}`} cx={x(data.length-1)} cy={y(last[k])}
            r="4" fill={colors[i]} stroke="#fff" strokeWidth="2" />
        );
      })}
    </svg>
  );
}

// SVG bar chart
function BarChart({ data, keys, colors, height = 200 }) {
  const w = 560, h = height, pad = { top:16, right:16, bottom:32, left:40 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top  - pad.bottom;

  const allVals = data.flatMap(d => keys.map(k => d[k]));
  const maxV    = Math.max(...allVals) * 1.15;

  const groupW  = innerW / data.length;
  const barW    = Math.min((groupW / keys.length) * 0.7, 22);
  const groupPad= (groupW - barW * keys.length) / 2;

  const bx = (i, ki) => pad.left + i * groupW + groupPad + ki * barW;
  const bh = (v)      => (v / maxV) * innerH;
  const by = (v)      => pad.top + innerH - bh(v);

  const yTicks = [0, 0.5, 1].map(f => Math.round(maxV * f));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width:"100%", height:"auto" }}>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={pad.left} x2={w - pad.right}
            y1={pad.top + innerH - (v/maxV)*innerH}
            y2={pad.top + innerH - (v/maxV)*innerH}
            stroke={T.border} strokeWidth="1" strokeDasharray="4 3" />
          <text x={pad.left-6} y={pad.top + innerH - (v/maxV)*innerH + 4}
            textAnchor="end" fontSize={10} fill={T.textMuted} fontFamily={font.body}>{v}</text>
        </g>
      ))}

      {data.map((d, i) => (
        <text key={i} x={pad.left + i * groupW + groupW/2} y={h-6}
          textAnchor="middle" fontSize={10} fill={T.textMuted} fontFamily={font.body}>{d.month}</text>
      ))}

      {data.map((d, i) =>
        keys.map((k, ki) => (
          <rect key={`${i}-${ki}`}
            x={bx(i, ki)} y={by(d[k])}
            width={barW - 1} height={bh(d[k])}
            rx="3"
            fill={colors[ki]} opacity="0.85" />
        ))
      )}
    </svg>
  );
}

// Donut chart
function DonutChart({ data, size = 180 }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38, ir = size * 0.24;
  let angle = -Math.PI / 2;

  const slices = data.map(d => {
    const sweep = (d.pct / 100) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle), y2 = cy + r * Math.sin(angle);
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
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} opacity="0.9" />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={18} fontWeight="700"
        fill={T.navy} fontFamily={font.head}>{total.toLocaleString()}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9}
        fill={T.textMuted} fontFamily={font.body}>TOTAL PARCELS</text>
    </svg>
  );
}

// Mini sparkline
function Sparkline({ values, color = T.teal, width = 80, height = 28 }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length-1)/(values.length-1)*width} cy={height - ((values[values.length-1]-min)/range)*(height-4)-2} r="3" fill={color} />
    </svg>
  );
}

// County bar (horizontal)
function CountyBar({ label, value, max, total }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:500, color:T.text }}>{label}</span>
        <span style={{ fontSize:13, color:T.textMuted }}>{value} <span style={{ fontSize:11, color:T.textMuted }}>({((value/total)*100).toFixed(1)}%)</span></span>
      </div>
      <div style={{ height:8, background:T.bgDark, borderRadius:4, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${pct}%`, borderRadius:4,
          background: `linear-gradient(90deg, ${T.teal} 0%, ${T.tealMid} 100%)`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:12 }}>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
          <span style={{ fontSize:12, color:T.textMuted }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Panel({ title, subtitle, action, children, style = {} }) {
  return (
    <div style={{
      background: T.white, border:`1px solid ${T.border}`,
      borderRadius:12, padding:"22px 24px",
      boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
      ...style,
    }}>
      {(title || action) && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <h3 style={{ fontFamily:font.head, fontSize:16, fontWeight:600, color:T.navy, marginBottom:2 }}>{title}</h3>
            {subtitle && <p style={{ fontSize:12, color:T.textMuted }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 16px", border:"none", borderRadius:8,
      background: active ? T.navy : "transparent",
      color: active ? "#fff" : T.textMuted,
      fontSize:13, fontWeight:500, cursor:"pointer",
      transition:"all 0.15s",
    }}>{label}</button>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────
function ExportBtn({ label = "Export" }) {
  return (
    <button style={{
      display:"flex", alignItems:"center", gap:6,
      padding:"7px 14px", border:`1px solid ${T.border}`,
      borderRadius:8, background:T.white, color:T.slate,
      fontSize:12, fontWeight:500, cursor:"pointer",
    }}>
      <span>↓</span>{label}
    </button>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg:T.bgDark, color:T.slate };
  return (
    <span style={{
      background:s.bg, color:s.color,
      padding:"2px 10px", borderRadius:20,
      fontSize:11, fontWeight:500,
    }}>{status}</span>
  );
}

// ─── Main Reports Dashboard ───────────────────────────────────────────────────
export default function ReportsDashboard() {
  const [period,      setPeriod]      = useState("2025");
  const [chartTab,    setChartTab]    = useState("registrations");
  const [countyMetric,setCountyMetric]= useState("parcels");
  const [txFilter,    setTxFilter]    = useState("ALL");

  const PERIOD_OPTIONS = ["2023","2024","2025","Q1 2025","Q2 2025","Last 30 days"];

  const filteredTx = txFilter === "ALL"
    ? RECENT_TRANSACTIONS
    : RECENT_TRANSACTIONS.filter(t => t.type === txFilter || t.status === txFilter);

  const countyTotal = COUNTY_DATA.reduce((a,b) => a + b[countyMetric], 0);
  const countyMax   = Math.max(...COUNTY_DATA.map(c => c[countyMetric]));

  // Sparkline data per county (simulated)
  const sparkFor = (base) => Array.from({length:8}, (_,i) => base + Math.round(Math.random()*20-10));

  const summaryStats = [
    { label:"Total Registrations", value:"1,152",  delta:18,  deltaLabel:"YoY", icon:"📋", accent:true  },
    { label:"Ownership Transfers",  value:"547",    delta:24,  deltaLabel:"YoY", icon:"🔄", accent:false },
    { label:"Active Encumbrances",  value:"203",    delta:-5,  deltaLabel:"YoY", icon:"🔒", accent:false },
    { label:"Total Value Transacted",value:"KES 24.8B",delta:31,deltaLabel:"YoY",icon:"💰",accent:false },
  ];

  return (
    <div style={{
      fontFamily: font.body,
      background: T.bg,
      minHeight: "100vh",
      color: T.text,
    }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
        padding: "28px 32px 32px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative geometry */}
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, opacity:0.06,
          backgroundImage:`repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)`,
          backgroundSize:"20px 20px" }} />
        <div style={{ position:"absolute", right:32, top:16, width:120, height:120, borderRadius:"50%",
          border:"1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ position:"absolute", right:56, top:36, width:72, height:72, borderRadius:"50%",
          border:"1px solid rgba(255,255,255,0.08)" }} />

        <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <div style={{ width:8, height:28, background:T.teal, borderRadius:4 }} />
              <h1 style={{ fontFamily:font.head, fontSize:24, fontWeight:700, color:"#fff" }}>
                Reports &amp; Analytics
              </h1>
            </div>
            <p style={{ color:"#94A3B8", fontSize:13, marginLeft:18 }}>
              Blockchain Land Registry · Ministry of Lands, Kenya · Generated {new Date().toLocaleDateString("en-KE",{day:"numeric",month:"long",year:"numeric"})}
            </p>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Period selector */}
            <div style={{ display:"flex", background:"rgba(255,255,255,0.07)", borderRadius:10, padding:3, gap:1 }}>
              {PERIOD_OPTIONS.map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding:"6px 12px", border:"none", borderRadius:8,
                  background: period === p ? T.teal : "transparent",
                  color: period === p ? "#fff" : "#94A3B8",
                  fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap",
                  transition:"all 0.15s",
                }}>{p}</button>
              ))}
            </div>
            <button style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"9px 16px", borderRadius:8,
              background:T.teal, border:"none",
              color:"#fff", fontSize:13, fontWeight:500, cursor:"pointer",
            }}>
              <span>↓</span> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div style={{ padding:"28px 32px", maxWidth:1400, margin:"0 auto" }}>

        {/* KPI row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
          {summaryStats.map(s => <KPICard key={s.label} {...s} />)}
        </div>

        {/* Row 1: main chart + donut */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, marginBottom:20 }}>

          {/* Main trend chart */}
          <Panel
            title={chartTab === "registrations" ? "Registration Activity" : "Transfer Outcomes"}
            subtitle={`Monthly breakdown — ${period}`}
            action={
              <div style={{ display:"flex", gap:3, background:T.bg, borderRadius:8, padding:3 }}>
                <TabBtn label="Registrations" active={chartTab==="registrations"} onClick={() => setChartTab("registrations")} />
                <TabBtn label="Transfers"     active={chartTab==="transfers"}     onClick={() => setChartTab("transfers")}     />
              </div>
            }
          >
            {chartTab === "registrations" ? (
              <>
                <LineChart
                  data={REGISTRATION_DATA}
                  keys={["parcels","transfers","encumbrances"]}
                  colors={[T.chart.teal, T.chart.navy, T.chart.gold]}
                  height={220}
                />
                <Legend items={[
                  {label:"Parcels Registered", color:T.chart.teal },
                  {label:"Transfers",          color:T.chart.navy },
                  {label:"Encumbrances",       color:T.chart.gold },
                ]} />
              </>
            ) : (
              <>
                <BarChart
                  data={TRANSFER_TREND}
                  keys={["approved","rejected"]}
                  colors={[T.chart.teal, T.chart.coral]}
                  height={220}
                />
                <Legend items={[
                  {label:"Approved", color:T.chart.teal  },
                  {label:"Rejected", color:T.chart.coral },
                ]} />
              </>
            )}
          </Panel>

          {/* Donut + land use */}
          <Panel title="Land Use Distribution" subtitle="Active parcels by type">
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
              <DonutChart data={LAND_USE_DATA} size={164} />
              <div style={{ width:"100%" }}>
                {LAND_USE_DATA.map(d => (
                  <div key={d.type} style={{
                    display:"flex", justifyContent:"space-between",
                    alignItems:"center", padding:"8px 0",
                    borderBottom:`1px solid ${T.border}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                      <span style={{ fontSize:13, color:T.text }}>{d.type}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontSize:13, fontWeight:600, color:T.navy }}>{d.count.toLocaleString()}</span>
                      <span style={{ fontSize:11, color:T.textMuted, marginLeft:4 }}>({d.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Row 2: county breakdown + transfer summary */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

          {/* County breakdown */}
          <Panel
            title="County Performance"
            subtitle="Top counties by activity"
            action={
              <div style={{ display:"flex", gap:3, background:T.bg, borderRadius:8, padding:3 }}>
                {["parcels","transfers"].map(m => (
                  <TabBtn key={m} label={m === "parcels" ? "Parcels" : "Transfers"}
                    active={countyMetric===m} onClick={() => setCountyMetric(m)} />
                ))}
              </div>
            }
          >
            {COUNTY_DATA.map(c => (
              <CountyBar
                key={c.county}
                label={c.county}
                value={c[countyMetric]}
                max={countyMax}
                total={countyTotal}
              />
            ))}
          </Panel>

          {/* Transfer outcome summary */}
          <Panel title="Transfer Outcomes" subtitle={`Full year summary — ${period}`}>
            {/* Big numbers row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
              {[
                { label:"Approved", value:547, pct:84, color:T.success, bg:T.successLt },
                { label:"Rejected", value:82,  pct:13, color:T.danger,  bg:T.dangerLt  },
                { label:"Pending",  value:19,  pct:3,  color:"#1D4ED8", bg:"#EFF6FF"   },
              ].map(s => (
                <div key={s.label} style={{
                  background:s.bg, borderRadius:10,
                  padding:"14px 16px", textAlign:"center",
                }}>
                  <p style={{ fontFamily:font.head, fontSize:26, fontWeight:700, color:s.color }}>{s.value}</p>
                  <p style={{ fontSize:12, color:s.color, fontWeight:500, marginTop:2 }}>{s.label}</p>
                  <p style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{s.pct}% of total</p>
                </div>
              ))}
            </div>

            {/* Value by type */}
            <div style={{ background:T.bg, borderRadius:10, padding:16 }}>
              <p style={{ fontSize:12, fontWeight:600, color:T.navy, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                Total Value by Transfer Type
              </p>
              {[
                { type:"Sale",         value:"KES 18.4B", pct:74 },
                { type:"Inheritance",  value:"KES 3.2B",  pct:13 },
                { type:"Gift",         value:"KES 2.1B",  pct:8.5},
                { type:"Court Order",  value:"KES 1.1B",  pct:4.5},
              ].map(r => (
                <div key={r.type} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:13, color:T.textMid, minWidth:100 }}>{r.type}</span>
                  <div style={{ flex:1, height:7, background:T.border, borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${r.pct}%`, background:`linear-gradient(90deg, ${T.teal}, ${T.tealMid})`, borderRadius:4 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color:T.navy, minWidth:80, textAlign:"right" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Row 3: county sparklines */}
        <Panel
          title="County Trends"
          subtitle="Monthly registration activity per county (sparklines)"
          action={<ExportBtn label="Export CSV" />}
          style={{ marginBottom:20 }}
        >
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:700 }}>
              <thead>
                <tr style={{ background:T.bg }}>
                  {["County","Parcels","Transfers","Est. Value","Trend (12mo)",""].map((h,i) => (
                    <th key={i} style={{
                      padding:"10px 14px", textAlign: i > 1 ? "right" : "left",
                      color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.border}`,
                      fontSize:12, letterSpacing:"0.03em", textTransform:"uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COUNTY_DATA.map((c, i) => {
                  const spark = sparkFor(c.parcels);
                  const trend = spark[7] > spark[0];
                  return (
                    <tr key={c.county} style={{ borderBottom:`1px solid ${T.border}` }}>
                      <td style={{ padding:"12px 14px", fontWeight:600, color:T.navy }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:T.tealLt, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:T.teal, fontFamily:font.mono, fontWeight:600 }}>
                            {c.county[0]}
                          </div>
                          {c.county}
                        </div>
                      </td>
                      <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>{c.parcels.toLocaleString()}</td>
                      <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>{c.transfers.toLocaleString()}</td>
                      <td style={{ padding:"12px 14px", textAlign:"right", color:T.textMid }}>{c.value}</td>
                      <td style={{ padding:"12px 14px", textAlign:"right" }}>
                        <Sparkline values={spark} color={trend ? T.chart.teal : T.chart.coral} />
                      </td>
                      <td style={{ padding:"12px 14px", textAlign:"right" }}>
                        <span style={{ fontSize:11, fontWeight:600, color: trend ? T.success : T.danger }}>
                          {trend ? "▲" : "▼"} {Math.abs(spark[7]-spark[0])}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Row 4: Recent transactions */}
        <Panel
          title="Recent Transactions"
          subtitle="Latest blockchain events across all counties"
          action={
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <div style={{ display:"flex", gap:4, background:T.bg, borderRadius:8, padding:3 }}>
                {["ALL","Transfer","Registration","Encumbrance"].map(f => (
                  <TabBtn key={f} label={f} active={txFilter===f} onClick={() => setTxFilter(f)} />
                ))}
              </div>
              <ExportBtn label="CSV" />
            </div>
          }
        >
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:750 }}>
              <thead>
                <tr style={{ background:T.bg }}>
                  {["Transaction ID","Type","Parcel","County","Value","Status","Date"].map((h,i) => (
                    <th key={i} style={{
                      padding:"10px 14px",
                      textAlign: i >= 4 ? "right" : "left",
                      color:T.textMuted, fontWeight:500,
                      borderBottom:`1px solid ${T.border}`,
                      fontSize:12, textTransform:"uppercase", letterSpacing:"0.03em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:"12px 14px" }}>
                      <span style={{ fontFamily:font.mono, fontSize:12, color:T.teal }}>{tx.id}</span>
                    </td>
                    <td style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:15 }}>{TYPE_ICON[tx.type] || "📄"}</span>
                        <span style={{ color:T.textMid }}>{tx.type}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px 14px", fontFamily:font.mono, fontSize:11, color:T.textMid }}>{tx.parcel}</td>
                    <td style={{ padding:"12px 14px" }}>{tx.county}</td>
                    <td style={{ padding:"12px 14px", textAlign:"right", fontWeight:500 }}>{tx.value}</td>
                    <td style={{ padding:"12px 14px", textAlign:"right" }}><StatusPill status={tx.status} /></td>
                    <td style={{ padding:"12px 14px", textAlign:"right", color:T.textMuted }}>{tx.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div style={{
            marginTop:16, padding:"14px 16px",
            background:T.bg, borderRadius:8,
            display:"flex", gap:24, flexWrap:"wrap",
          }}>
            {[
              ["Total Transactions", RECENT_TRANSACTIONS.length],
              ["Approved",  RECENT_TRANSACTIONS.filter(t=>t.status==="APPROVED").length],
              ["Pending",   RECENT_TRANSACTIONS.filter(t=>t.status==="PENDING").length],
              ["Rejected",  RECENT_TRANSACTIONS.filter(t=>t.status==="REJECTED").length],
            ].map(([k,v]) => (
              <div key={k}>
                <span style={{ fontSize:12, color:T.textMuted }}>{k}: </span>
                <span style={{ fontSize:13, fontWeight:600, color:T.navy }}>{v}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── System Health footer ──────────────────────────────────── */}
        <div style={{
          marginTop:20,
          background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
          borderRadius:12, padding:"18px 24px",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16,
        }}>
          <div>
            <p style={{ fontFamily:font.head, fontSize:14, fontWeight:600, color:"#fff" }}>System Health</p>
            <p style={{ fontSize:12, color:"#64748B", marginTop:2 }}>Hyperledger Fabric Network · {new Date().toLocaleTimeString("en-KE")}</p>
          </div>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            {[
              { label:"Fabric Peers",  value:"2/2 Online", ok:true  },
              { label:"CouchDB",       value:"Healthy",    ok:true  },
              { label:"IPFS Node",     value:"Healthy",    ok:true  },
              { label:"API Latency",   value:"142ms",      ok:true  },
              { label:"Block Height",  value:"#48,291",    ok:true  },
              { label:"Pending Tx",    value:"3",          ok:true  },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"center" }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background: s.ok ? "#34D399" : T.danger }} />
                  <span style={{ fontSize:12, fontWeight:600, color:"#fff" }}>{s.value}</span>
                </div>
                <p style={{ fontSize:11, color:"#64748B", marginTop:2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}