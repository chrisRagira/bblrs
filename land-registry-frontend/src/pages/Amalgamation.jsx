import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ─── Design tokens (shared with LandTransfer) ──────────────────────────────
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
  indigo:  "#3730A3", indigoLt: "#EEF2FF",
};
const font = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Amalgamation stages ───────────────────────────────────────────────────
const STAGES = [
  {
    id: "parcel_selection",
    label: "Parcel Selection",
    shortLabel: "Parcels",
    icon: "🗂",
    description: "Select two or more contiguous parcels under common ownership to amalgamate",
    time: "Same day",
    law: "Land Registration Act 2012 §25",
  },
  {
    id: "survey",
    label: "Survey & Mutation",
    shortLabel: "Survey",
    icon: "📐",
    description: "Upload the approved survey mutation from a licensed Government Surveyor",
    time: "2–4 weeks",
    law: "Survey Act Cap 299 §18",
  },
  {
    id: "documents",
    label: "Supporting Documents",
    shortLabel: "Documents",
    icon: "📋",
    description: "Provide consents, clearances, and all original title deeds for the parcels being merged",
    time: "3–5 days",
    law: "Land Registration Regulations 2017",
  },
  {
    id: "technical_review",
    label: "Technical Review",
    shortLabel: "Review",
    icon: "🔍",
    description: "County surveyor and registrar verify contiguity, encumbrances, and survey accuracy",
    time: "1–2 weeks",
    law: "Land Registration Act 2012 §26",
  },
  {
    id: "registration",
    label: "Registration",
    shortLabel: "Register",
    icon: "🏷",
    description: "Registrar cancels old titles and issues a new consolidated title on the blockchain",
    time: "Minutes (on-chain)",
    law: "Land Registration Act 2012 §27",
  },
];

// ─── Shared UI atoms ───────────────────────────────────────────────────────
function Alert({ type = "info", children }) {
  const map = {
    info:    { bg: T.infoLt,    color: T.info,    border: T.info,    icon: "ℹ" },
    success: { bg: T.successLt, color: T.success, border: T.success, icon: "✓" },
    warn:    { bg: T.warnLt,    color: T.warn,    border: T.gold,    icon: "⚠" },
    danger:  { bg: T.dangerLt,  color: T.danger,  border: T.danger,  icon: "✕" },
  };
  const s = map[type];
  return (
    <div style={{
      background: s.bg, borderLeft: `3px solid ${s.border}`,
      borderRadius: "0 7px 7px 0", padding: "10px 14px",
      display: "flex", gap: 10, alignItems: "flex-start",
      marginBottom: 16, fontSize: 13,
    }}>
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
            border: `1px solid ${T.border}`, borderRadius: 7,
            fontSize: 14, fontFamily: font.body, background: readOnly ? T.bg : T.white,
            color: T.text, outline: "none", transition: "border-color 0.15s",
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
        style={{
          width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`,
          borderRadius: 7, fontSize: 14, fontFamily: font.body,
          background: T.white, color: T.text, outline: "none",
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Demo owned parcels ───────────────────────────────────────────────────
const OWNED_PARCELS = [
  { parcelId: "a1b2", titleNumber: "KE/NKR/2024/0042", county: "Nakuru",  areaHectares: 0.25, landUseType: "RESIDENTIAL",  status: "ACTIVE", encumbrances: 0 },
  { parcelId: "b2c3", titleNumber: "KE/NKR/2024/0043", county: "Nakuru",  areaHectares: 0.30, landUseType: "RESIDENTIAL",  status: "ACTIVE", encumbrances: 0 },
  { parcelId: "c3d4", titleNumber: "KE/NKR/2023/0180", county: "Nakuru",  areaHectares: 0.45, landUseType: "RESIDENTIAL",  status: "ACTIVE", encumbrances: 1 },
  { parcelId: "d4e5", titleNumber: "KE/MOM/2022/0091", county: "Mombasa", areaHectares: 1.80, landUseType: "AGRICULTURAL", status: "ACTIVE", encumbrances: 0 },
];

// ─── Stage: Parcel Selection ──────────────────────────────────────────────
function StageParcelSelection({ selectedIds, setSelectedIds, form, setForm }) {
  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selected = OWNED_PARCELS.filter(p => selectedIds.includes(p.parcelId));
  const totalArea = selected.reduce((s, p) => s + p.areaHectares, 0);
  const hasEncumbrance = selected.some(p => p.encumbrances > 0);
  const mixedCounty = selected.length > 1 && new Set(selected.map(p => p.county)).size > 1;

  return (
    <>
      <Alert type="info">
        Select <strong>two or more contiguous parcels</strong> under your ownership. All parcels must be in the same county and share a boundary. Encumbered parcels may require lender consent.
      </Alert>

      <p style={{ fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 10 }}>
        Your Parcels <span style={{ color: T.danger }}>*</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {OWNED_PARCELS.map(p => {
          const isSelected = selectedIds.includes(p.parcelId);
          return (
            <div
              key={p.parcelId}
              onClick={() => toggle(p.parcelId)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "13px 16px", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${isSelected ? T.teal : T.border}`,
                background: isSelected ? T.tealLt : T.white,
                transition: "all 0.18s ease",
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${isSelected ? T.teal : T.border}`,
                background: isSelected ? T.teal : T.white,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}>
                {isSelected && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: font.mono, fontSize: 12, color: T.navy, fontWeight: 600 }}>{p.titleNumber}</span>
                  <span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: "2px 7px", borderRadius: 8 }}>{p.landUseType}</span>
                  {p.encumbrances > 0 && (
                    <span style={{ fontSize: 11, color: T.warn, background: T.warnLt, padding: "2px 7px", borderRadius: 8 }}>⚠ {p.encumbrances} encumbrance</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                  {p.county} · {p.areaHectares} ha · {p.status}
                </p>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: isSelected ? T.teal : T.text, fontFamily: font.mono }}>
                  {p.areaHectares} ha
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {selected.length > 0 && (
        <div style={{
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: 9, padding: 16, marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Amalgamation Preview
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              ["Parcels Selected",   selected.length,                         selected.length < 2 ? T.danger : T.success],
              ["Combined Area",      `${totalArea.toFixed(2)} ha`,             T.navy],
              ["County Consistency", mixedCounty ? "⚠ Multiple counties" : "✓ Same county", mixedCounty ? T.danger : T.success],
            ].map(([k, v, c]) => (
              <div key={k} style={{ textAlign: "center", padding: "10px", background: T.white, borderRadius: 7, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</p>
                <p style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{k}</p>
              </div>
            ))}
          </div>
          {hasEncumbrance && (
            <div style={{ marginTop: 12 }}>
              <Alert type="warn">One or more selected parcels have active encumbrances. Written consent from all chargees must be obtained and uploaded in the Documents stage.</Alert>
            </div>
          )}
          {mixedCounty && (
            <div style={{ marginTop: 12 }}>
              <Alert type="danger">Parcels span multiple counties. Amalgamation requires all parcels to be within the same county registry.</Alert>
            </div>
          )}
        </div>
      )}

      {/* New title description */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
          Intended Use of Amalgamated Parcel <span style={{ color: T.danger }}>*</span>
        </label>
        <textarea
          value={form.intendedUse || ""}
          onChange={e => setForm(p => ({ ...p, intendedUse: e.target.value }))}
          placeholder="Describe the intended development or use of the resulting consolidated parcel…"
          style={{
            width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`,
            borderRadius: 7, fontSize: 14, fontFamily: font.body,
            minHeight: 72, resize: "vertical", color: T.text, outline: "none",
          }}
          onFocus={e => (e.target.style.borderColor = T.teal)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>

      <FormField
        label="Proposed New Title Number (leave blank to auto-assign)"
        name="proposedTitleNumber"
        value={form.proposedTitleNumber || ""}
        onChange={e => setForm(p => ({ ...p, proposedTitleNumber: e.target.value }))}
        placeholder="e.g. KE/NKR/2025/XXXX"
        icon="🔖"
        helper="The Registrar will assign the final number. You may propose one for reference."
      />
    </>
  );
}

// ─── Stage: Survey & Mutation ─────────────────────────────────────────────
function StageSurvey({ form, setForm, selectedParcels }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  return (
    <>
      <Alert type="info">
        A licensed Government Surveyor must prepare a <strong>mutation form</strong> showing the new consolidated boundary. Upload the approved mutation and beacons description.
      </Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormField label="Surveyor's Full Name" name="surveyorName" value={form.surveyorName || ""} onChange={set("surveyorName")} placeholder="Eng. John Kamau" required icon="👤" />
        <FormField label="Survey Licence Number" name="surveyorLicence" value={form.surveyorLicence || ""} onChange={set("surveyorLicence")} placeholder="LSK/SURV/2024/XXXX" required icon="🪪" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormField label="Survey Date" name="surveyDate" type="date" value={form.surveyDate || ""} onChange={set("surveyDate")} required />
        <FormField label="Director of Surveys Approval Date" name="doaApprovalDate" type="date" value={form.doaApprovalDate || ""} onChange={set("doaApprovalDate")} required />
      </div>

      <FormField label="Mutation Form Number" name="mutationFormNo" value={form.mutationFormNo || ""} onChange={set("mutationFormNo")} placeholder="MUT/NKR/2025/XXXX" required icon="📐" />

      {/* Combined area readonly */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormField
          label="Total Combined Area (ha)"
          name="totalArea"
          value={selectedParcels.reduce((s, p) => s + p.areaHectares, 0).toFixed(4)}
          readOnly icon="📏"
          helper="Auto-calculated from selected parcels"
        />
        <FormField label="Area per Survey (ha) — verify against mutation" name="surveyedArea" type="number" value={form.surveyedArea || ""} onChange={set("surveyedArea")} placeholder="e.g. 0.5500" required icon="📏" />
      </div>

      {form.surveyedArea && Math.abs(parseFloat(form.surveyedArea) - selectedParcels.reduce((s, p) => s + p.areaHectares, 0)) > 0.005 && (
        <Alert type="warn">
          Area discrepancy detected between registry records and the survey mutation. Differences greater than 0.005 ha require a written explanation from the surveyor.
        </Alert>
      )}

      {/* File uploads */}
      {[
        { key: "mutationFile",   label: "Mutation Form (signed & stamped PDF)", required: true },
        { key: "beaconsFile",    label: "Beacons Description / Field Notes",    required: true },
        { key: "surveyPlanFile", label: "Survey Plan / Map",                    required: false },
      ].map(doc => (
        <div key={doc.key} style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
            {doc.label}{doc.required && <span style={{ color: T.danger }}> *</span>}
          </label>
          <div style={{
            border: `2px dashed ${form[doc.key] ? T.success : T.border}`,
            borderRadius: 8, padding: "16px", textAlign: "center",
            background: form[doc.key] ? T.successLt : T.white,
          }}>
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

// ─── Stage: Supporting Documents ─────────────────────────────────────────
function StageDocuments({ form, setForm, selectedParcels }) {
  const BASE_DOCS = [
    { key: "ownerID",          label: "Owner National ID / Passport",        required: true  },
    { key: "ownerKraPin",      label: "Owner KRA PIN Certificate",            required: true  },
    { key: "landRentClear",    label: "Land Rent Clearance (all parcels)",    required: true  },
    { key: "ratesClear",       label: "County Rates Clearance (all parcels)", required: true  },
  ];
  const titleDeedDocs = selectedParcels.map((p, i) => ({
    key: `titleDeed_${p.parcelId}`,
    label: `Original Title Deed — ${p.titleNumber}`,
    required: true,
  }));
  const encumbranceDocs = selectedParcels
    .filter(p => p.encumbrances > 0)
    .map(p => ({
      key: `chargeeConsent_${p.parcelId}`,
      label: `Chargee Consent — ${p.titleNumber}`,
      required: true,
    }));

  const ALL_DOCS = [...titleDeedDocs, ...BASE_DOCS, ...encumbranceDocs];
  const uploaded = ALL_DOCS.filter(d => form[d.key]).length;

  return (
    <>
      <Alert type="info">
        All original title deeds for the parcels being merged must be surrendered. Documents are stored on IPFS with hashes anchored to the blockchain.
      </Alert>

      {ALL_DOCS.map(doc => (
        <div key={doc.key} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", marginBottom: 8,
          border: `1px solid ${form[doc.key] ? T.success : T.border}`,
          borderRadius: 8, background: form[doc.key] ? T.successLt : T.white,
          transition: "all 0.2s",
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
              background: T.white, color: form[doc.key] ? T.success : T.textMid,
              cursor: "pointer", whiteSpace: "nowrap",
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

// ─── Stage: Technical Review ──────────────────────────────────────────────
function StageTechnicalReview({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  return (
    <>
      <Alert type="info">
        The County Surveyor and Land Registrar must confirm that the parcels are contiguous, the mutation is accurate, and there are no overlapping claims.
      </Alert>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormField label="County Surveyor Name" name="countySurveyorName" value={form.countySurveyorName || ""} onChange={set("countySurveyorName")} placeholder="Full name" required icon="👤" />
        <FormField label="Contiguity Confirmation Date" name="contiguityDate" type="date" value={form.contiguityDate || ""} onChange={set("contiguityDate")} required />
      </div>

      <SelectField
        label="Contiguity Verification Status"
        name="contiguityStatus"
        value={form.contiguityStatus || "PENDING"}
        onChange={set("contiguityStatus")}
        options={[
          { value: "PENDING",   label: "Pending field inspection" },
          { value: "CONFIRMED", label: "Contiguity confirmed" },
          { value: "DISPUTED",  label: "Boundary dispute identified" },
        ]}
        required
      />

      {form.contiguityStatus === "DISPUTED" && (
        <>
          <Alert type="danger">A boundary dispute must be resolved before registration can proceed. The parties may apply to the Environment and Land Court.</Alert>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Dispute Details <span style={{ color: T.danger }}>*</span></label>
            <textarea
              value={form.disputeDetails || ""}
              onChange={e => setForm(p => ({ ...p, disputeDetails: e.target.value }))}
              placeholder="Describe the nature of the boundary dispute and parties involved…"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.danger}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, minHeight: 80, resize: "vertical" }}
            />
          </div>
        </>
      )}

      {form.contiguityStatus === "CONFIRMED" && (
        <>
          <FormField label="Overlap Check Reference Number" name="overlapCheckRef" value={form.overlapCheckRef || ""} onChange={set("overlapCheckRef")} placeholder="NLIMS/OVR/2025/XXXX" icon="🔍" helper="Obtained from NLIMS national land information system" />

          <div style={{ background: T.successLt, border: `1px solid ${T.success}30`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.success, marginBottom: 8 }}>Technical Review Checklist</p>
            {[
              "All parcel boundaries are shared or touching",
              "No third-party interests overlap the amalgamated area",
              "Survey mutation matches registry coordinates",
              "Total area reconciled (±0.005 ha tolerance)",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < 3 ? `1px solid ${T.success}20` : "none" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: T.success, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 12, color: T.success }}>{item}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>Reviewer Notes</label>
        <textarea
          value={form.reviewNotes || ""}
          onChange={e => setForm(p => ({ ...p, reviewNotes: e.target.value }))}
          placeholder="Add technical review observations, conditions, or queries…"
          style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 14, fontFamily: font.body, minHeight: 72, resize: "vertical" }}
          onFocus={e => (e.target.style.borderColor = T.teal)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>
    </>
  );
}

// ─── Stage: Registration ──────────────────────────────────────────────────
function StageRegistration({ form, selectedParcels, onApprove, onReject, loading }) {
  const [reason, setReason] = useState("");
  const totalArea = selectedParcels.reduce((s, p) => s + p.areaHectares, 0);

  return (
    <>
      <Alert type="warn">
        Approval will <strong>cancel all selected title deeds</strong> and issue one new consolidated title on the Hyperledger Fabric ledger. This action is irreversible.
      </Alert>

      {/* Parcels being cancelled */}
      <div style={{ background: T.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Titles to be Cancelled ({selectedParcels.length})
        </p>
        {selectedParcels.map(p => (
          <div key={p.parcelId} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
            <span style={{ fontFamily: font.mono, color: T.danger, fontSize: 12 }}>{p.titleNumber}</span>
            <span style={{ color: T.textMuted }}>{p.areaHectares} ha · {p.county}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 13, fontWeight: 600 }}>
          <span style={{ color: T.navy }}>New Consolidated Title</span>
          <span style={{ color: T.teal, fontFamily: font.mono }}>{totalArea.toFixed(4)} ha</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ background: T.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: T.navy, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Registration Summary</p>
        {[
          ["Operation",         "Amalgamation"],
          ["Surveyor",          form.surveyorName || "—"],
          ["Mutation Form",     form.mutationFormNo || "—"],
          ["Contiguity Status", form.contiguityStatus || "—"],
          ["Combined Area",     `${totalArea.toFixed(4)} ha`],
          ["Intended Use",      form.intendedUse || "—"],
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
          onFocus={e => (e.target.style.borderColor = T.teal)}
          onBlur={e => (e.target.style.borderColor = T.border)}
        />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onReject(reason)} disabled={loading} style={{
          flex: 1, padding: "11px", borderRadius: 7, fontFamily: font.body,
          fontWeight: 500, fontSize: 14, cursor: "pointer",
          background: T.dangerLt, color: T.danger, border: `1px solid ${T.danger}40`,
        }}>✕ Reject Amalgamation</button>
        <button onClick={onApprove} disabled={loading} style={{
          flex: 1, padding: "11px", borderRadius: 7, fontFamily: font.body,
          fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
          background: T.teal, color: "#fff", border: `1px solid ${T.teal}`,
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Processing…" : "✓ Approve & Issue New Title"}
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
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Amalgamation Progress</p>
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
function SuccessScreen({ txId, selectedParcels, form, onReset }) {
  const totalArea = selectedParcels.reduce((s, p) => s + p.areaHectares, 0);
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: T.successLt, border: `2px solid ${T.success}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: 32, animation: "scaleIn 0.4s ease",
      }}>✓</div>
      <h2 style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: T.navy, marginBottom: 8 }}>
        Amalgamation Complete
      </h2>
      <p style={{ color: T.textMuted, fontSize: 15, marginBottom: 24 }}>
        {selectedParcels.length} titles cancelled. New consolidated title registered on the Hyperledger Fabric ledger.
      </p>
      <div style={{ background: T.bg, borderRadius: 10, padding: 20, maxWidth: 440, margin: "0 auto 28px", textAlign: "left" }}>
        {[
          ["Parcels Merged",    selectedParcels.length],
          ["Total Area",        `${totalArea.toFixed(4)} ha`],
          ["Blockchain TX",     txId],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
            <span style={{ color: T.textMuted }}>{k}</span>
            <span style={{ fontFamily: k === "Blockchain TX" ? font.mono : font.body, fontSize: k === "Blockchain TX" ? 11 : 13, fontWeight: 500, color: k === "Blockchain TX" ? T.teal : T.text }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={onReset} style={{ padding: "10px 24px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14, cursor: "pointer", border: `1px solid ${T.border}`, background: T.white, color: T.navy }}>
          New Amalgamation
        </button>
        <Link to="/dashboard" style={{ padding: "10px 24px", borderRadius: 7, fontFamily: font.body, fontWeight: 500, fontSize: 14, textDecoration: "none", background: T.navy, color: "#fff", display: "inline-block" }}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function Amalgamation() {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [activeStage,   setActiveStage]   = useState(0);
  const [completedUpTo, setCompletedUpTo] = useState(0);
  const [selectedIds,   setSelectedIds]   = useState([]);
  const [form,          setForm]          = useState({});
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [done,          setDone]          = useState(false);
  const [txId,          setTxId]          = useState("");
  const contentRef = useRef(null);

  const selectedParcels = OWNED_PARCELS.filter(p => selectedIds.includes(p.parcelId));

  const scrollToContent = () => setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const handleNext = async () => {
    setError("");
    const stage = STAGES[activeStage];

    if (stage.id === "parcel_selection") {
      if (selectedIds.length < 2) { setError("Select at least two parcels to amalgamate."); return; }
      const counties = new Set(selectedParcels.map(p => p.county));
      if (counties.size > 1) { setError("All parcels must be in the same county."); return; }
      if (!form.intendedUse?.trim()) { setError("Please describe the intended use of the amalgamated parcel."); return; }
    }

    if (stage.id === "survey") {
      if (!form.surveyorName || !form.surveyorLicence || !form.mutationFormNo || !form.surveyDate || !form.doaApprovalDate || !form.surveyedArea) {
        setError("Please complete all required survey fields."); return;
      }
      if (!form.mutationFile || !form.beaconsFile) { setError("Upload the mutation form and beacons description."); return; }
    }

    if (stage.id === "technical_review") {
      if (!form.contiguityStatus || form.contiguityStatus === "PENDING") { setError("Contiguity verification must be completed before proceeding."); return; }
      if (form.contiguityStatus === "DISPUTED") { setError("Boundary dispute must be resolved before registration."); return; }
    }

    setCompletedUpTo(prev => Math.max(prev, activeStage + 1));
    setActiveStage(prev => Math.min(prev + 1, STAGES.length - 1));
    scrollToContent();
  };

  const handlePrev = () => { setError(""); setActiveStage(prev => Math.max(prev - 1, 0)); scrollToContent(); };

  const handleApprove = async () => {
    setLoading(true); setError("");
    try {
      await new Promise(r => setTimeout(r, 1400));
      setTxId(`0x${Math.random().toString(16).slice(2, 18).toUpperCase()}`);
      setDone(true);
    } catch { setError("Blockchain commit failed. Please retry."); }
    setLoading(false);
  };

  const handleReject = async (reason) => {
    if (!reason.trim()) { setError("Please provide a rejection reason."); return; }
    alert(`Amalgamation rejected. Reason: ${reason}`);
    navigate("/registrar/queue");
  };

  const handleReset = () => {
    setActiveStage(0); setCompletedUpTo(0); setSelectedIds([]); setForm({});
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
            <span style={{ color: "#94A3B8", fontSize: 13 }}>Land Amalgamation</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 5 }}>
                Parcel Amalgamation
              </h1>
              <p style={{ color: "#94A3B8", fontSize: 13 }}>
                Land Registration Act 2012 §25–27 · Merge contiguous parcels into one title
              </p>
            </div>
            {selectedIds.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 16px", display: "flex", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: font.mono }}>{selectedIds.length}</p>
                  <p style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Parcels</p>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.15)" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: T.teal, fontFamily: font.mono }}>
                    {selectedParcels.reduce((s, p) => s + p.areaHectares, 0).toFixed(2)} ha
                  </p>
                  <p style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Area</p>
                </div>
              </div>
            )}
          </div>
          {/* Mini progress */}
          <div style={{ display: "flex", gap: 6, marginTop: 20, alignItems: "center" }}>
            {STAGES.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: i === activeStage ? "auto" : 28, minWidth: 28, height: 6, borderRadius: 3,
                  background: i < completedUpTo ? T.teal : i === activeStage ? "#fff" : "rgba(255,255,255,0.15)",
                  padding: i === activeStage ? "0 10px" : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: T.navy, fontWeight: 600, transition: "all 0.3s ease",
                }}>
                  {i === activeStage ? s.shortLabel : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {done ? (
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <SuccessScreen txId={txId} selectedParcels={selectedParcels} form={form} onReset={handleReset} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            <ProgressRail stages={STAGES} activeIdx={activeStage} completedUpTo={completedUpTo} />

            <div style={{ flex: 1, minWidth: 0 }} ref={contentRef}>
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
                {/* Stage header */}
                <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, background: `linear-gradient(135deg, ${T.navy}08 0%, transparent 100%)` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${T.navy}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {currentStage.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h2 style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: T.navy }}>{currentStage.label}</h2>
                        <span style={{ fontSize: 11, color: T.textMuted, background: T.bg, padding: "2px 9px", borderRadius: 10 }}>
                          Step {activeStage + 1} of {STAGES.length}
                        </span>
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

                {/* Stage form */}
                <div style={{ padding: "22px 24px" }} className="stage-content" key={activeStage}>
                  {error && (
                    <div style={{ background: T.dangerLt, borderLeft: `3px solid ${T.danger}`, borderRadius: "0 7px 7px 0", padding: "10px 14px", display: "flex", gap: 10, marginBottom: 16 }}>
                      <span style={{ color: T.danger, fontWeight: 600 }}>✕</span>
                      <span style={{ color: T.danger, fontSize: 13 }}>{error}</span>
                    </div>
                  )}

                  {currentStage.id === "parcel_selection" && <StageParcelSelection selectedIds={selectedIds} setSelectedIds={setSelectedIds} form={form} setForm={setForm} />}
                  {currentStage.id === "survey"           && <StageSurvey form={form} setForm={setForm} selectedParcels={selectedParcels} />}
                  {currentStage.id === "documents"        && <StageDocuments form={form} setForm={setForm} selectedParcels={selectedParcels} />}
                  {currentStage.id === "technical_review" && <StageTechnicalReview form={form} setForm={setForm} />}
                  {currentStage.id === "registration"     && <StageRegistration form={form} selectedParcels={selectedParcels} onApprove={handleApprove} onReject={handleReject} loading={loading} />}
                </div>
              </div>

              {/* Navigation */}
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