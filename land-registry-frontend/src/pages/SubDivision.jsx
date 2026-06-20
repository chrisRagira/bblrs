import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────
const T = {
  navy:    "#0B1F3A", navyMid: "#1A3558", navyLt: "#243C5F",
  teal:    "#0D7A6F", tealLt:  "#E0F2F0", tealMid: "#0A6560",
  gold:    "#C28A1A", goldLt:  "#FBF3DC",
  border:  "#E2E8F0", bg: "#F7F9FC", white: "#FFFFFF",
  danger:  "#C53030", dangerLt: "#FFF5F5",
  success: "#276749", successLt: "#F0FFF4",
  warn:    "#92400E", warnLt: "#FFFBEB",
  info:    "#1D4ED8", infoLt: "#EFF6FF",
  text:    "#1A202C", textMid: "#4A5568", textMuted: "#718096",
  purple:  "#6D28D9", purpleLt: "#F5F3FF",
};
const font = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// Sub-parcel palette for visual differentiation
const SUB_COLORS = [
  { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8", label: "A" },
  { bg: "#F0FFF4", border: "#10B981", text: "#065F46", label: "B" },
  { bg: "#FFF7ED", border: "#F59E0B", text: "#92400E", label: "C" },
  { bg: "#FDF4FF", border: "#A855F7", text: "#6D28D9", label: "D" },
  { bg: "#FFF1F2", border: "#F43F5E", text: "#9F1239", label: "E" },
  { bg: "#F0FDFA", border: "#14B8A6", text: "#0F766E", label: "F" },
];

// ─── Subdivision stages ───────────────────────────────────────────────────
const STAGES = [
  {
    id: "parcel_selection",
    label: "Source Parcel",
    shortLabel: "Source",
    icon: "📍",
    description: "Select the parcel to be subdivided and specify the number of resulting sub-parcels",
    time: "Same day",
    law: "Land Registration Act 2012 §19",
  },
  {
    id: "subdivision_plan",
    label: "Subdivision Plan",
    shortLabel: "Plan",
    icon: "📐",
    description: "Define the area, use, and intended owner for each resulting sub-parcel",
    time: "1–3 days",
    law: "Physical & Land Use Planning Act 2019",
  },
  {
    id: "planning_approval",
    label: "Planning Approval",
    shortLabel: "Planning",
    icon: "🏛",
    description: "County planning authority approval and change of user consent (if applicable)",
    time: "2–6 weeks",
    law: "Physical & Land Use Planning Act 2019 §58",
  },
  {
    id: "survey",
    label: "Survey & Mutation",
    shortLabel: "Survey",
    icon: "📏",
    description: "Government Surveyor prepares mutation forms for each new sub-parcel",
    time: "2–4 weeks",
    law: "Survey Act Cap 299 §18",
  },
  {
    id: "documents",
    label: "Supporting Documents",
    shortLabel: "Documents",
    icon: "📋",
    description: "Upload original title deed, clearances, and all sub-parcel transfer documents",
    time: "3–5 days",
    law: "Land Registration Regulations 2017",
  },
  {
    id: "registration",
    label: "Registration",
    shortLabel: "Register",
    icon: "🏷",
    description: "Registrar cancels the parent title and issues new individual titles on the blockchain",
    time: "Minutes (on-chain)",
    law: "Land Registration Act 2012 §21",
  },
];

// ─── Shared atoms ─────────────────────────────────────────────────────────
function Alert({ type = "info", children }) {
  const map = {
    info:    { bg: T.infoLt,    color: T.info,    border: T.info,    icon: "ℹ" },
    success: { bg: T.successLt, color: T.success, border: T.success, icon: "✓" },
    warn:    { bg: T.warnLt,    color: T.warn,    border: T.gold,    icon: "⚠" },
    danger:  { bg: T.dangerLt,  color: T.danger,  border: T.danger,  icon: "✕" },
  };
  const s = map[type];
  return (
    <div style={{ background: s.bg, borderLeft: `3px solid ${s.border}`, borderRadius: "0 7px 7px 0", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, fontSize: 13 }}>
      <span style={{ color: s.color, fontWeight: 600, fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ color: s.color, lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

function FormField({ label, name, type = "text", value, onChange, placeholder, helper, required, icon, readOnly }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.danger }}> *</span>}
      </label>
      <div style={{ position: "relative" }}>
        {icon && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>{icon}</span>}
        <input
          type={type} name={name} value={value} onChange={onChange}
          placeholder={placeholder} required={required} readOnly={readOnly}
          style={{
            width: "100%", padding: icon ? "10px 12px 10px 36px" : "10px 12px",
            border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14,
            fontFamily: font.body, background: readOnly ? T.bg : T.white,
            color: T.text, outline: "none",
          }}
          onFocus={e => !readOnly && (e.target.style.borderColor = T.teal)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>
      {helper && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{helper}</p>}
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.danger }}> *</span>}
      </label>
      <select name={name} value={value} onChange={onChange} required={required}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Demo owned parcels ───────────────────────────────────────────────────
const OWNED_PARCELS = [
  { parcelId: "a1b2", titleNumber: "KE/NKR/2024/0042", county: "Nakuru",  areaHectares: 2.50, landUseType: "RESIDENTIAL",  status: "ACTIVE", encumbrances: 0 },
  { parcelId: "b2c3", titleNumber: "KE/MOM/2023/0180", county: "Mombasa", areaHectares: 5.80, landUseType: "AGRICULTURAL", status: "ACTIVE", encumbrances: 1 },
  { parcelId: "c3d4", titleNumber: "KE/NBI/2022/0091", county: "Nairobi", areaHectares: 0.80, landUseType: "COMMERCIAL",   status: "ACTIVE", encumbrances: 0 },
];

// Minimum plot size requirements (ha) by land use type
const MIN_PLOT_SIZE = {
  RESIDENTIAL:  0.04,
  AGRICULTURAL: 0.20,
  COMMERCIAL:   0.05,
  INDUSTRIAL:   0.10,
};

// ─── Stage: Source Parcel ─────────────────────────────────────────────────
function StageSourceParcel({ form, setForm }) {
  const set = f => v => setForm(p => ({ ...p, [f]: v }));
  const selectedParcel = OWNED_PARCELS.find(p => p.parcelId === form.parcelId);
  const minSize = selectedParcel ? MIN_PLOT_SIZE[selectedParcel.landUseType] || 0.05 : 0;
  const maxSubParcels = selectedParcel ? Math.floor(selectedParcel.areaHectares / minSize) : 0;

  return (
    <>
      <Alert type="info">
        Select the parcel to subdivide. Minimum sub-plot sizes are enforced per county planning rules. All resulting plots must meet the minimum for the land use category.
      </Alert>

      <p style={{ fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 10 }}>
        Select Parcel <span style={{ color: T.danger }}>*</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {OWNED_PARCELS.map(p => {
          const isSelected = form.parcelId === p.parcelId;
          return (
            <div
              key={p.parcelId}
              onClick={() => setForm(prev => ({ ...prev, parcelId: p.parcelId, subParcels: [] }))}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "13px 16px", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${isSelected ? T.teal : T.border}`,
                background: isSelected ? T.tealLt : T.white,
                transition: "all 0.18s ease",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${isSelected ? T.teal : T.border}`,
                background: isSelected ? T.teal : T.white,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: font.mono, fontSize: 12, color: T.navy, fontWeight: 600 }}>{p.titleNumber}</span>
                  <span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: "2px 7px", borderRadius: 8 }}>{p.landUseType}</span>
                  {p.encumbrances > 0 && <span style={{ fontSize: 11, color: T.warn, background: T.warnLt, padding: "2px 7px", borderRadius: 8 }}>⚠ {p.encumbrances} encumbrance</span>}
                </div>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{p.county} · {p.areaHectares} ha · {p.status}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: isSelected ? T.teal : T.text, fontFamily: font.mono }}>{p.areaHectares} ha</p>
                {isSelected && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Max {maxSubParcels} plots</p>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedParcel && (
        <>
          {selectedParcel.encumbrances > 0 && (
            <Alert type="warn">This parcel has active encumbrances. Written consent from all chargees must be obtained before subdivision can be registered.</Alert>
          )}

          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subdivision Constraints</p>
            {[
              ["Parent Area",          `${selectedParcel.areaHectares} ha`],
              ["Land Use Type",        selectedParcel.landUseType],
              ["Min. Sub-plot Size",   `${minSize} ha (${(minSize * 10000).toLocaleString()} m²)`],
              ["Maximum Sub-plots",    maxSubParcels],
              ["County",               selectedParcel.county],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span style={{ color: T.textMuted }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Number of sub-parcels */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 8 }}>
              Number of Sub-plots to Create <span style={{ color: T.danger }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[2, 3, 4, 5, 6].filter(n => n <= maxSubParcels).map(n => (
                <button
                  key={n}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    subParcelCount: n,
                    subParcels: Array.from({ length: n }, (_, i) => ({
                      id: i,
                      label: SUB_COLORS[i].label,
                      areaHectares: "",
                      landUse: selectedParcel.landUseType,
                      ownerName: "",
                      ownerNationalId: "",
                      proposedTitleRef: "",
                    })),
                  }))}
                  style={{
                    width: 52, height: 52, borderRadius: 10, fontSize: 18, fontWeight: 700,
                    border: `2px solid ${form.subParcelCount === n ? T.teal : T.border}`,
                    background: form.subParcelCount === n ? T.teal : T.white,
                    color: form.subParcelCount === n ? "#fff" : T.text,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >{n}</button>
              ))}
            </div>
            {maxSubParcels < 2 && (
              <Alert type="danger">This parcel is too small to subdivide under planning regulations (minimum plot size: {minSize} ha).</Alert>
            )}
          </div>

          <SelectField
            label="Reason for Subdivision"
            name="subdivisionReason"
            value={form.subdivisionReason || ""}
            onChange={e => setForm(p => ({ ...p, subdivisionReason: e.target.value }))}
            options={[
              { value: "",           label: "— Select reason —" },
              { value: "SALE",       label: "Sale of portions" },
              { value: "FAMILY",     label: "Family distribution / inheritance" },
              { value: "DEVELOPMENT",label: "Development / separate buildings" },
              { value: "GIFTING",    label: "Gifting" },
              { value: "OTHER",      label: "Other" },
            ]}
            required
          />
        </>
      )}
    </>
  );
}

// ─── Stage: Subdivision Plan ──────────────────────────────────────────────
function StageSubdivisionPlan({ form, setForm }) {
  const selectedParcel = OWNED_PARCELS.find(p => p.parcelId === form.parcelId);
  const subParcels = form.subParcels || [];
  const totalAllocated = subParcels.reduce((s, sp) => s + (parseFloat(sp.areaHectares) || 0), 0);
  const parentArea = selectedParcel?.areaHectares || 0;
  const remainder = parentArea - totalAllocated;
  const isBalanced = Math.abs(remainder) < 0.001;

  const updateSub = (idx, field, value) => {
    setForm(prev => {
      const updated = [...(prev.subParcels || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, subParcels: updated };
    });
  };

  return (
    <>
      <Alert type="info">
        Allocate the area for each sub-parcel. The sum must equal the parent parcel area exactly (±0.001 ha tolerance). Specify the intended owner for each plot.
      </Alert>

      {/* Area balance bar */}
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: 14, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.navy }}>Area Allocation</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: isBalanced ? T.success : remainder < 0 ? T.danger : T.warn }}>
            {totalAllocated.toFixed(4)} / {parentArea.toFixed(4)} ha
            {!isBalanced && ` (${remainder > 0 ? "−" : "+"}${Math.abs(remainder).toFixed(4)} ha ${remainder > 0 ? "unallocated" : "over"})`}
          </span>
        </div>
        {/* Stacked bar */}
        <div style={{ height: 10, borderRadius: 5, background: T.border, overflow: "hidden", display: "flex" }}>
          {subParcels.map((sp, i) => {
            const pct = parentArea > 0 ? ((parseFloat(sp.areaHectares) || 0) / parentArea) * 100 : 0;
            return (
              <div key={i} style={{
                height: "100%", width: `${pct}%`,
                background: SUB_COLORS[i % SUB_COLORS.length].border,
                transition: "width 0.4s ease",
              }} />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {subParcels.map((sp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: SUB_COLORS[i % SUB_COLORS.length].border }} />
              <span style={{ fontSize: 11, color: T.textMuted }}>Plot {SUB_COLORS[i].label}: {parseFloat(sp.areaHectares || 0).toFixed(4)} ha</span>
            </div>
          ))}
        </div>
        {isBalanced && <p style={{ fontSize: 11, color: T.success, marginTop: 8 }}>✓ Total area balanced</p>}
      </div>

      {/* Sub-parcel cards */}
      {subParcels.map((sp, i) => {
        const clr = SUB_COLORS[i % SUB_COLORS.length];
        const minSize = MIN_PLOT_SIZE[sp.landUse] || 0.05;
        const area = parseFloat(sp.areaHectares) || 0;
        const tooSmall = area > 0 && area < minSize;

        return (
          <div key={i} style={{ border: `2px solid ${clr.border}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
            {/* Card header */}
            <div style={{ background: clr.bg, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${clr.border}40` }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: clr.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                {clr.label}
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, color: clr.text }}>Plot {clr.label}</span>
              {area > 0 && <span style={{ fontSize: 12, color: clr.text, marginLeft: "auto", fontFamily: font.mono }}>{area.toFixed(4)} ha</span>}
            </div>

            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
                    Area (ha) <span style={{ color: T.danger }}>*</span>
                  </label>
                  <input
                    type="number" value={sp.areaHectares} placeholder={`min. ${minSize}`}
                    onChange={e => updateSub(i, "areaHectares", e.target.value)}
                    style={{
                      width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: font.mono,
                      border: `1px solid ${tooSmall ? T.danger : T.border}`, borderRadius: 7,
                      background: T.white, color: T.text, outline: "none",
                    }}
                    onFocus={e => (e.target.style.borderColor = clr.border)}
                    onBlur={e => (e.target.style.borderColor = tooSmall ? T.danger : T.border)}
                  />
                  {tooSmall && <p style={{ fontSize: 11, color: T.danger, marginTop: 3 }}>Below minimum {minSize} ha</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Land Use</label>
                  <select
                    value={sp.landUse}
                    onChange={e => updateSub(i, "landUse", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
                  >
                    {["RESIDENTIAL","AGRICULTURAL","COMMERCIAL","INDUSTRIAL"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ marginBottom: 0 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
                    Intended Owner Name <span style={{ color: T.danger }}>*</span>
                  </label>
                  <input
                    type="text" value={sp.ownerName} placeholder="Full legal name"
                    onChange={e => updateSub(i, "ownerName", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
                    onFocus={e => (e.target.style.borderColor = T.teal)}
                    onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                </div>
                <div style={{ marginBottom: 0 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Owner National ID</label>
                  <input
                    type="text" value={sp.ownerNationalId} placeholder="e.g. 12345678"
                    onChange={e => updateSub(i, "ownerNationalId", e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
                    onFocus={e => (e.target.style.borderColor = T.teal)}
                    onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Stage: Planning Approval ─────────────────────────────────────────────
function StagePlanningApproval({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const selectedParcel = OWNED_PARCELS.find(p => p.parcelId === form.parcelId);
  const needsChangeOfUser = (form.subParcels || []).some(sp => sp.landUse !== selectedParcel?.landUseType);

  return (
    <>
      <Alert type="info">
        All subdivision plans require Physical Planning Department approval. If any sub-plot has a different land use from the parent parcel, a <strong>Change of User</strong> certificate is also required.
      </Alert>

      {needsChangeOfUser && (
        <Alert type="warn">
          One or more sub-plots have a different land use from the parent parcel. A Change of User Certificate from the County Director of Physical Planning is mandatory.
        </Alert>
      )}

      <SelectField
        label="Planning Approval Status"
        name="planningStatus"
        value={form.planningStatus || "PENDING"}
        onChange={set("planningStatus")}
        options={[
          { value: "PENDING",   label: "Application pending" },
          { value: "APPROVED",  label: "Approval granted" },
          { value: "REJECTED",  label: "Application rejected" },
          { value: "DEFERRED",  label: "Deferred — additional info required" },
        ]}
        required
      />

      {form.planningStatus === "APPROVED" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
                Approval Reference Number <span style={{ color: T.danger }}>*</span>
              </label>
              <input type="text" value={form.planningApprovalRef || ""} onChange={set("planningApprovalRef")} placeholder="PPD/NKR/2025/XXXX"
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.mono, background: T.white, color: T.text, outline: "none" }}
                onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
                Approval Date <span style={{ color: T.danger }}>*</span>
              </label>
              <input type="date" value={form.planningApprovalDate || ""} onChange={set("planningApprovalDate")}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
                onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>
          </div>

          {needsChangeOfUser && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
                    Change of User Certificate No. <span style={{ color: T.danger }}>*</span>
                  </label>
                  <input type="text" value={form.changeOfUserRef || ""} onChange={set("changeOfUserRef")} placeholder="COU/NKR/2025/XXXX"
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.mono, background: T.white, color: T.text, outline: "none" }}
                    onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Change of User Date</label>
                  <input type="date" value={form.changeOfUserDate || ""} onChange={set("changeOfUserDate")}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
                    onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Upload planning approval */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Upload Planning Approval Letter <span style={{ color: T.danger }}>*</span></label>
            <div style={{ border: `2px dashed ${form.planningApprovalFile ? T.success : T.border}`, borderRadius: 8, padding: "16px", textAlign: "center", background: form.planningApprovalFile ? T.successLt : T.white }}>
              <input type="file" accept=".pdf" style={{ display: "none" }} id="planning-approval"
                onChange={e => setForm(p => ({ ...p, planningApprovalFile: e.target.files[0] }))} />
              <label htmlFor="planning-approval" style={{ cursor: "pointer", fontSize: 13, color: form.planningApprovalFile ? T.success : T.textMuted }}>
                {form.planningApprovalFile ? `✓  ${form.planningApprovalFile.name}` : "📄  Click to upload planning approval (PDF)"}
              </label>
            </div>
          </div>
        </>
      )}

      {form.planningStatus === "REJECTED" && (
        <>
          <Alert type="danger">Planning rejection blocks registration. The applicant may appeal to the Physical Planning Appeals Board within 60 days.</Alert>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Rejection Grounds <span style={{ color: T.danger }}>*</span></label>
            <textarea value={form.planningRejectionReason || ""} onChange={e => setForm(p => ({ ...p, planningRejectionReason: e.target.value }))}
              placeholder="State the grounds for rejection as recorded in the planning committee minutes…"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.danger}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, minHeight: 80, resize: "vertical" }}
            />
          </div>
        </>
      )}

      {form.planningStatus === "DEFERRED" && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Additional Information Requested</label>
          <textarea value={form.planningDeferralReason || ""} onChange={e => setForm(p => ({ ...p, planningDeferralReason: e.target.value }))}
            placeholder="Describe what additional information the planning authority has requested…"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, minHeight: 72, resize: "vertical" }}
            onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
      )}
    </>
  );
}

// ─── Stage: Survey ────────────────────────────────────────────────────────
function StageSurvey({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const subParcels = form.subParcels || [];

  return (
    <>
      <Alert type="info">
        A licensed Government Surveyor must prepare a separate mutation form for each sub-parcel. Upload the composite mutation or individual mutations for all resulting plots.
      </Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Surveyor's Full Name <span style={{ color: T.danger }}>*</span></label>
          <input type="text" value={form.surveyorName || ""} onChange={set("surveyorName")} placeholder="Eng. Jane Waweru"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
            onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Survey Licence Number <span style={{ color: T.danger }}>*</span></label>
          <input type="text" value={form.surveyorLicence || ""} onChange={set("surveyorLicence")} placeholder="ISK/2024/XXXX"
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
            onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Survey Date <span style={{ color: T.danger }}>*</span></label>
          <input type="date" value={form.surveyDate || ""} onChange={set("surveyDate")}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
            onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Director of Surveys Approval Date <span style={{ color: T.danger }}>*</span></label>
          <input type="date" value={form.doaApprovalDate || ""} onChange={set("doaApprovalDate")}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, background: T.white, color: T.text, outline: "none" }}
            onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
          />
        </div>
      </div>

      {/* Per-plot mutation form numbers */}
      <p style={{ fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 10 }}>Mutation Form Numbers per Sub-plot <span style={{ color: T.danger }}>*</span></p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {subParcels.map((sp, i) => {
          const clr = SUB_COLORS[i % SUB_COLORS.length];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: clr.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {clr.label}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, color: T.textMuted, marginBottom: 3 }}>
                  Plot {clr.label} · {sp.ownerName || "—"} · {sp.areaHectares || "0"} ha
                </label>
                <input
                  type="text"
                  value={sp.mutationFormNo || ""}
                  onChange={e => {
                    const updated = [...(form.subParcels || [])];
                    updated[i] = { ...updated[i], mutationFormNo: e.target.value };
                    setForm(p => ({ ...p, subParcels: updated }));
                  }}
                  placeholder={`MUT/NKR/2025/00${i + 1}`}
                  style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: font.mono, background: T.white, color: T.text, outline: "none" }}
                  onFocus={e => (e.target.style.borderColor = clr.border)}
                  onBlur={e => (e.target.style.borderColor = T.border)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* File uploads */}
      {[
        { key: "mutationFile",   label: "Composite Mutation Form (all sub-plots)", required: true },
        { key: "surveyPlanFile", label: "Survey Plan / Subdivision Map",           required: true },
      ].map(doc => (
        <div key={doc.key} style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
            {doc.label}{doc.required && <span style={{ color: T.danger }}> *</span>}
          </label>
          <div style={{ border: `2px dashed ${form[doc.key] ? T.success : T.border}`, borderRadius: 8, padding: "16px", textAlign: "center", background: form[doc.key] ? T.successLt : T.white }}>
            <input type="file" accept=".pdf,.jpg,.png" style={{ display: "none" }} id={`surv-${doc.key}`}
              onChange={e => setForm(p => ({ ...p, [doc.key]: e.target.files[0] }))} />
            <label htmlFor={`surv-${doc.key}`} style={{ cursor: "pointer", fontSize: 13, color: form[doc.key] ? T.success : T.textMuted }}>
              {form[doc.key] ? `✓  ${form[doc.key].name}` : "📄  Click to upload (PDF, JPG, PNG · max 10MB)"}
            </label>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Stage: Documents ─────────────────────────────────────────────────────
function StageDocuments({ form, setForm }) {
  const BASE_DOCS = [
    { key: "titleDeed",     label: "Original Title Deed (Parent Parcel)", required: true },
    { key: "ownerID",       label: "Owner National ID / Passport",        required: true },
    { key: "ownerKraPin",   label: "Owner KRA PIN Certificate",            required: true },
    { key: "landRentClear", label: "Land Rent Clearance Certificate",      required: true },
    { key: "ratesClear",    label: "County Rates Clearance Certificate",   required: true },
  ];
  const ALL_DOCS = BASE_DOCS;
  const uploaded = ALL_DOCS.filter(d => form[d.key]).length;

  return (
    <>
      <Alert type="info">
        The original parent title deed will be cancelled upon registration. All documents stored on IPFS with hashes anchored on-chain.
      </Alert>

      {ALL_DOCS.map(doc => (
        <div key={doc.key} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8,
          border: `1px solid ${form[doc.key] ? T.success : T.border}`,
          borderRadius: 8, background: form[doc.key] ? T.successLt : T.white, transition: "all 0.2s",
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: form[doc.key] ? T.success : T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
            {form[doc.key] ? <span style={{ color: "#fff", fontSize: 14 }}>✓</span> : "📄"}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: form[doc.key] ? T.success : T.text }}>
              {doc.label}{doc.required && <span style={{ color: T.danger, fontSize: 11 }}> *</span>}
            </p>
            {form[doc.key] && <p style={{ fontSize: 11, color: T.success, marginTop: 2 }}>{form[doc.key].name}</p>}
          </div>
          <div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} id={`doc-${doc.key}`}
              onChange={e => setForm(p => ({ ...p, [doc.key]: e.target.files[0] }))} />
            <label htmlFor={`doc-${doc.key}`} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: `1px solid ${form[doc.key] ? T.success : T.border}`,
              background: T.white, color: form[doc.key] ? T.success : T.textMid, cursor: "pointer",
            }}>
              {form[doc.key] ? "Replace" : "Upload"}
            </label>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14, padding: "12px 14px", background: T.bg, borderRadius: 8 }}>
        <p style={{ fontSize: 12, color: T.textMuted }}>
          {uploaded} / {ALL_DOCS.length} documents uploaded
          {" · "}{ALL_DOCS.filter(d => d.required && !form[d.key]).length} required remaining
        </p>
        <div style={{ height: 6, background: T.border, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(uploaded / ALL_DOCS.length) * 100}%`, background: `linear-gradient(90deg, ${T.teal}, #0FA896)`, borderRadius: 3, transition: "width 0.4s ease" }} />
        </div>
      </div>
    </>
  );
}

// ─── Stage: Registration ──────────────────────────────────────────────────
function StageRegistration({ form, onApprove, onReject, loading }) {
  const [reason, setReason] = useState("");
  const selectedParcel = OWNED_PARCELS.find(p => p.parcelId === form.parcelId);
  const subParcels = form.subParcels || [];

  return (
    <>
      <Alert type="warn">
        Approval will <strong>cancel the parent title</strong> and issue {subParcels.length} new individual titles on the Hyperledger Fabric ledger. This action is irreversible.
      </Alert>

      {/* Sub-parcel summary */}
      <div style={{ background: T.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          New Titles to be Created ({subParcels.length})
        </p>
        {subParcels.map((sp, i) => {
          const clr = SUB_COLORS[i % SUB_COLORS.length];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: clr.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {clr.label}
              </div>
              <span style={{ fontSize: 13, flex: 1, color: T.text }}>{sp.ownerName || "—"}</span>
              <span style={{ fontSize: 12, color: T.textMuted, fontFamily: font.mono }}>{parseFloat(sp.areaHectares || 0).toFixed(4)} ha</span>
              <span style={{ fontSize: 11, background: clr.bg, color: clr.text, padding: "2px 8px", borderRadius: 8 }}>{sp.landUse}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 13 }}>
          <span style={{ color: T.textMuted }}>Parent title cancelled</span>
          <span style={{ fontFamily: font.mono, color: T.danger, fontSize: 12 }}>{selectedParcel?.titleNumber}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ background: T.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Registration Summary</p>
        {[
          ["Operation",         "Subdivision"],
          ["Planning Approval", form.planningApprovalRef || "—"],
          ["Surveyor",          form.surveyorName || "—"],
          ["Reason",            form.subdivisionReason || "—"],
          ["Sub-plots",         subParcels.length],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Registrar Notes (required for rejection)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Enter grounds for rejection if applicable…"
          style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: font.body, minHeight: 72, resize: "vertical" }}
          onFocus={e => (e.target.style.borderColor = T.teal)} onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onReject(reason)} disabled={loading} style={{
          flex: 1, padding: "11px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14,
          cursor: "pointer", background: T.dangerLt, color: T.danger, border: `1px solid ${T.danger}40`,
        }}>✕ Reject Subdivision</button>
        <button onClick={onApprove} disabled={loading} style={{
          flex: 1, padding: "11px", borderRadius: 7, fontFamily: font.body, fontWeight: 600, fontSize: 14,
          cursor: loading ? "not-allowed" : "pointer", background: T.teal, color: "#fff", border: `1px solid ${T.teal}`, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Processing…" : `✓ Approve & Issue ${(form.subParcels || []).length} New Titles`}
        </button>
      </div>
    </>
  );
}

// ─── Progress Rail ────────────────────────────────────────────────────────
function ProgressRail({ stages, activeIdx, completedUpTo }) {
  return (
    <div style={{ width: 220, flexShrink: 0 }}>
      <div style={{ position: "sticky", top: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Subdivision Progress</p>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 2, background: T.border, zIndex: 0 }} />
          <div style={{
            position: "absolute", left: 15, top: 8, width: 2, zIndex: 1,
            height: `${Math.max(0, (completedUpTo / (stages.length - 1)) * 100)}%`,
            background: `linear-gradient(180deg, ${T.teal} 0%, ${T.tealMid} 100%)`,
            transition: "height 0.5s ease",
          }} />
          {stages.map((stage, i) => {
            const isActive = i === activeIdx;
            const isCompleted = i < completedUpTo;
            return (
              <div key={stage.id} style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", gap: 14, marginBottom: i < stages.length - 1 ? 24 : 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isCompleted ? 14 : 13, fontWeight: 600,
                  background: isCompleted ? T.teal : isActive ? T.navy : T.white,
                  border: `2px solid ${isCompleted ? T.teal : isActive ? T.navy : T.border}`,
                  color: isCompleted ? "#fff" : isActive ? "#fff" : T.textMuted,
                  boxShadow: isActive ? `0 0 0 4px ${T.navy}18` : "none",
                  transition: "all 0.25s ease",
                }}>
                  {isCompleted ? "✓" : i + 1}
                </div>
                <div style={{ paddingTop: 5 }}>
                  <p style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isCompleted ? T.teal : isActive ? T.navy : T.textMid, lineHeight: 1.3 }}>
                    {stage.shortLabel}
                  </p>
                  {isActive && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{stage.time}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>Overall progress</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.navy }}>{Math.round((completedUpTo / stages.length) * 100)}%</span>
          </div>
          <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${(completedUpTo / stages.length) * 100}%`, background: `linear-gradient(90deg, ${T.teal} 0%, ${T.tealMid} 100%)`, transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────
function SuccessScreen({ txId, form, onReset }) {
  const subParcels = form.subParcels || [];
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: T.successLt, border: `2px solid ${T.success}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: 32, animation: "scaleIn 0.4s ease",
      }}>✓</div>
      <h2 style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: T.navy, marginBottom: 8 }}>
        Subdivision Complete
      </h2>
      <p style={{ color: T.textMuted, fontSize: 15, marginBottom: 24 }}>
        Parent title cancelled. {subParcels.length} new titles issued on the Hyperledger Fabric ledger.
      </p>
      <div style={{ background: T.bg, borderRadius: 10, padding: 20, maxWidth: 500, margin: "0 auto 28px", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
          <span style={{ color: T.textMuted }}>New Titles Issued</span>
          <span style={{ fontWeight: 600, color: T.success }}>{subParcels.length}</span>
        </div>
        {subParcels.map((sp, i) => {
          const clr = SUB_COLORS[i % SUB_COLORS.length];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: clr.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{clr.label}</div>
              <span style={{ flex: 1, color: T.text }}>{sp.ownerName || "—"}</span>
              <span style={{ color: T.textMuted, fontFamily: font.mono, fontSize: 11 }}>{parseFloat(sp.areaHectares || 0).toFixed(4)} ha</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13 }}>
          <span style={{ color: T.textMuted }}>Blockchain TX</span>
          <span style={{ fontFamily: font.mono, fontSize: 11, color: T.teal }}>{txId}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={onReset} style={{ padding: "10px 24px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14, cursor: "pointer", border: `1px solid ${T.border}`, background: T.white, color: T.navy }}>
          New Subdivision
        </button>
        <Link to="/dashboard" style={{ padding: "10px 24px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14, textDecoration: "none", background: T.navy, color: "#fff", display: "inline-block" }}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SubDivision() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [activeStage,   setActiveStage]   = useState(0);
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [form,          setForm]          = useState({ subParcels: [] });
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [done,          setDone]          = useState(false);
  const [txId,          setTxId]          = useState("");
  const contentRef = useRef(null);

  const selectedParcel = OWNED_PARCELS.find(p => p.parcelId === form.parcelId);
  const subParcels = form.subParcels || [];

  const scrollToContent = () => setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const handleNext = () => {
    setError("");
    const stage = STAGES[activeStage];

    if (stage.id === "parcel_selection") {
      if (!form.parcelId) { setError("Please select a parcel to subdivide."); return; }
      if (!form.subParcelCount || form.subParcelCount < 2) { setError("Select the number of sub-plots (minimum 2)."); return; }
      if (!form.subdivisionReason) { setError("Please select a reason for subdivision."); return; }
    }

    if (stage.id === "subdivision_plan") {
      if (subParcels.length === 0) { setError("No sub-parcel plan defined."); return; }
      const incompleteOwners = subParcels.filter(sp => !sp.ownerName?.trim());
      if (incompleteOwners.length > 0) { setError("Please specify an owner name for every sub-plot."); return; }
      const unallocated = subParcels.filter(sp => !sp.areaHectares || parseFloat(sp.areaHectares) <= 0);
      if (unallocated.length > 0) { setError("Please allocate an area to every sub-plot."); return; }
      const totalAllocated = subParcels.reduce((s, sp) => s + (parseFloat(sp.areaHectares) || 0), 0);
      const parentArea = selectedParcel?.areaHectares || 0;
      if (Math.abs(totalAllocated - parentArea) > 0.001) {
        setError(`Total allocated area (${totalAllocated.toFixed(4)} ha) must equal parent parcel area (${parentArea.toFixed(4)} ha).`); return;
      }
      const tooSmall = subParcels.find(sp => {
        const min = MIN_PLOT_SIZE[sp.landUse] || 0.05;
        return parseFloat(sp.areaHectares) < min;
      });
      if (tooSmall) {
        const clr = SUB_COLORS[subParcels.indexOf(tooSmall) % SUB_COLORS.length];
        setError(`Plot ${clr.label} is below the minimum size for ${tooSmall.landUse} land.`); return;
      }
    }

    if (stage.id === "planning_approval") {
      if (!form.planningStatus || form.planningStatus === "PENDING") { setError("Planning approval must have a final status before proceeding."); return; }
      if (form.planningStatus === "REJECTED") { setError("Planning approval was rejected. Subdivision cannot proceed."); return; }
      if (form.planningStatus === "DEFERRED") { setError("Planning is deferred. Resolve outstanding queries before proceeding."); return; }
      if (!form.planningApprovalRef) { setError("Please enter the planning approval reference number."); return; }
    }

    if (stage.id === "survey") {
      if (!form.surveyorName || !form.surveyorLicence || !form.surveyDate || !form.doaApprovalDate) {
        setError("Please complete all required survey fields."); return;
      }
      if (!form.mutationFile || !form.surveyPlanFile) { setError("Upload the mutation form and survey plan."); return; }
    }

    setCompletedUpTo(prev => Math.max(prev, activeStage + 1));
    setActiveStage(prev => Math.min(prev + 1, STAGES.length - 1));
    scrollToContent();
  };

  const handlePrev = () => { setError(""); setActiveStage(prev => Math.max(prev - 1, 0)); scrollToContent(); };

  const handleApprove = async () => {
    setLoading(true); setError("");
    try {
      await new Promise(r => setTimeout(r, 1600));
      setTxId(`0x${Math.random().toString(16).slice(2, 18).toUpperCase()}`);
      setDone(true);
    } catch { setError("Blockchain commit failed. Please retry."); }
    setLoading(false);
  };

  const handleReject = async (reason) => {
    if (!reason.trim()) { setError("Please provide a rejection reason."); return; }
    alert(`Subdivision rejected. Reason: ${reason}`);
    navigate("/registrar/queue");
  };

  const handleReset = () => {
    setActiveStage(0); setCompletedUpTo(0); setForm({ subParcels: [] });
    setDone(false); setTxId(""); setError("");
  };

  const currentStage = STAGES[activeStage];
  const isFirst = activeStage === 0;
  const isLast  = activeStage === STAGES.length - 1;

  return (
    <div style={{ fontFamily: font.body, background: T.bg, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400&display=swap');
        @keyframes scaleIn { from { transform: scale(0.7); opacity:0 } to { transform: scale(1); opacity:1 } }
        @keyframes fadeUp  { from { transform: translateY(12px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        .stage-content { animation: fadeUp 0.25s ease; }
        .next-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .next-btn { transition: all 0.15s ease; }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`, padding: "28px 32px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 260, opacity: 0.05, backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "18px 18px" }} />
        <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Link to="/dashboard" style={{ color: "#64748B", fontSize: 13, textDecoration: "none" }}>← Dashboard</Link>
            <span style={{ color: "#3D5070", fontSize: 13 }}>›</span>
            <span style={{ color: "#94A3B8", fontSize: 13 }}>Land Subdivision</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 5 }}>
                Parcel Subdivision
              </h1>
              <p style={{ color: "#94A3B8", fontSize: 13 }}>
                Physical &amp; Land Use Planning Act 2019 · Land Registration Act 2012 §19–21
              </p>
            </div>
            {subParcels.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {subParcels.map((sp, i) => {
                  const clr = SUB_COLORS[i % SUB_COLORS.length];
                  return (
                    <div key={i} style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${clr.border}60`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: clr.border, fontFamily: font.mono }}>{parseFloat(sp.areaHectares || 0).toFixed(2)} ha</p>
                      <p style={{ fontSize: 10, color: "#94A3B8" }}>Plot {clr.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Mini progress */}
          <div style={{ display: "flex", gap: 6, marginTop: 20, alignItems: "center" }}>
            {STAGES.map((s, i) => (
              <div key={s.id} style={{
                width: i === activeStage ? "auto" : 28, minWidth: 28, height: 6, borderRadius: 3,
                background: i < completedUpTo ? T.teal : i === activeStage ? "#fff" : "rgba(255,255,255,0.15)",
                padding: i === activeStage ? "0 10px" : 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: T.navy, fontWeight: 600, transition: "all 0.3s ease",
              }}>
                {i === activeStage ? s.shortLabel : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {done ? (
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <SuccessScreen txId={txId} form={form} onReset={handleReset} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            <ProgressRail stages={STAGES} activeIdx={activeStage} completedUpTo={completedUpTo} />

            <div style={{ flex: 1, minWidth: 0 }} ref={contentRef}>
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
                <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, background: `linear-gradient(135deg, ${T.navy}08 0%, transparent 100%)` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${T.navy}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {currentStage.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h2 style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: T.navy }}>{currentStage.label}</h2>
                        <span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: "2px 9px", borderRadius: 10 }}>Step {activeStage + 1} of {STAGES.length}</span>
                      </div>
                      <p style={{ fontSize: 13, color: T.textMuted, marginTop: 3 }}>{currentStage.description}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: T.textMuted }}>Typical time</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.navy, marginTop: 2 }}>{currentStage.time}</p>
                      <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4, fontFamily: font.mono }}>{currentStage.law}</p>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "22px 24px" }} className="stage-content" key={activeStage}>
                  {error && (
                    <div style={{ background: T.dangerLt, borderLeft: `3px solid ${T.danger}`, borderRadius: "0 7px 7px 0", padding: "10px 14px", display: "flex", gap: 10, marginBottom: 16 }}>
                      <span style={{ color: T.danger, fontWeight: 600 }}>✕</span>
                      <span style={{ color: T.danger, fontSize: 13 }}>{error}</span>
                    </div>
                  )}

                  {currentStage.id === "parcel_selection"  && <StageSourceParcel form={form} setForm={setForm} />}
                  {currentStage.id === "subdivision_plan"  && <StageSubdivisionPlan form={form} setForm={setForm} />}
                  {currentStage.id === "planning_approval" && <StagePlanningApproval form={form} setForm={setForm} />}
                  {currentStage.id === "survey"            && <StageSurvey form={form} setForm={setForm} />}
                  {currentStage.id === "documents"         && <StageDocuments form={form} setForm={setForm} />}
                  {currentStage.id === "registration"      && <StageRegistration form={form} onApprove={handleApprove} onReject={handleReject} loading={loading} />}
                </div>
              </div>

              {currentStage.id !== "registration" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={handlePrev} disabled={isFirst || loading} style={{
                    padding: "10px 22px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14,
                    cursor: isFirst ? "not-allowed" : "pointer", border: `1px solid ${T.border}`,
                    background: T.white, color: T.navy, opacity: isFirst ? 0.4 : 1,
                  }}>← Previous</button>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {STAGES.map((s, i) => (
                      <div key={s.id} style={{ width: i === activeStage ? 20 : 6, height: 6, borderRadius: 3, background: i < completedUpTo ? T.teal : i === activeStage ? T.navy : T.border, transition: "all 0.3s ease" }} />
                    ))}
                  </div>

                  <button onClick={handleNext} disabled={loading} className="next-btn" style={{
                    padding: "10px 28px", borderRadius: 7, fontFamily: font.body, fontWeight: 600, fontSize: 14,
                    cursor: loading ? "not-allowed" : "pointer", background: T.navy, color: "#fff",
                    border: `1px solid ${T.navy}`, opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? "Processing…" : isLast ? "Submit for Approval" : "Continue →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}