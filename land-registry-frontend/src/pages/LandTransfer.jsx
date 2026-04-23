import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { transfersApi, parcelsApi } from "../api/services";

// ─── Design tokens (inline for portability) ──────────────────────────────────
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
};
const font = {
  head: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Transfer stages config ───────────────────────────────────────────────────
const STAGES = [
  {
    id: "agreement",
    label: "Sale Agreement",
    shortLabel: "Agreement",
    icon: "📝",
    description: "Confirm parcel selection and upload the signed sale agreement",
    status_key: "PENDING",
    roles: ["LANDOWNER", "LEGAL"],
    required: ["parcelId", "transferType"],
    time: "Same day",
    law: "Land Registration Act 2012 §59",
  },
  {
    id: "lcb",
    label: "LCB Consent",
    shortLabel: "LCB",
    icon: "🏛",
    description: "Land Control Board consent — required for agricultural parcels",
    status_key: "AWAITING_LCB_CONSENT",
    roles: ["REGISTRAR"],
    required: [],
    time: "4–6 weeks",
    law: "Land Control Act Cap 302 §6",
    conditionalOn: "AGRICULTURAL",
  },
  {
    id: "valuation",
    label: "Valuation & Stamp Duty",
    shortLabel: "Stamp Duty",
    icon: "💰",
    description: "Government valuation and KRA stamp duty payment confirmation",
    status_key: "AWAITING_VALUATION",
    roles: ["REGISTRAR"],
    required: ["valuationKES", "stampDutyReceipt"],
    time: "1–2 weeks",
    law: "Stamp Duty Act Cap 480",
  },
  {
    id: "documents",
    label: "Document Checklist",
    shortLabel: "Documents",
    icon: "📋",
    description: "Upload all required clearances and supporting documents",
    status_key: "AWAITING_DOCUMENTS",
    roles: ["REGISTRAR", "LANDOWNER", "LEGAL"],
    required: ["titleDeed", "buyerID", "sellerID", "kraPin"],
    time: "3–5 days",
    law: "Land Registration Regulations 2017",
  },
  {
    id: "execution",
    label: "Execution",
    shortLabel: "Execution",
    icon: "✍",
    description: "Record physical execution before a Commissioner for Oaths",
    status_key: "AWAITING_APPROVAL",
    roles: ["REGISTRAR"],
    required: ["executionDate", "commissionerName"],
    time: "1–2 days",
    law: "Land Registration Act 2012 §61",
  },
  {
    id: "registration",
    label: "Registration",
    shortLabel: "Register",
    icon: "🏷",
    description: "Registrar approves and commits the transfer to the blockchain",
    status_key: "APPROVED",
    roles: ["REGISTRAR"],
    required: [],
    time: "Minutes (on-chain)",
    law: "Land Registration Act 2012 §63",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusMeta = {
  PENDING:                { color: T.info,    bg: T.infoLt,   label: "Pending"           },
  AWAITING_LCB_CONSENT:   { color: T.warn,    bg: T.warnLt,   label: "Awaiting LCB"      },
  AWAITING_VALUATION:     { color: T.warn,    bg: T.warnLt,   label: "Awaiting Valuation" },
  AWAITING_DOCUMENTS:     { color: T.warn,    bg: T.warnLt,   label: "Awaiting Docs"      },
  AWAITING_APPROVAL:      { color: T.gold,    bg: T.goldLt,   label: "Under Review"       },
  APPROVED:               { color: T.success, bg: T.successLt,label: "Approved"           },
  REJECTED:               { color: T.danger,  bg: T.dangerLt, label: "Rejected"           },
};

function StatusPill({ status }) {
  const m = statusMeta[status] || { color: T.textMuted, bg: T.bg, label: status };
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: "3px 11px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
      display: "inline-block",
    }}>{m.label}</span>
  );
}

function FormField({ label, name, type = "text", value, onChange, placeholder, helper, required, icon }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: T.textMid, marginBottom: 5 }}>
        {label}{required && <span style={{ color: T.danger }}> *</span>}
      </label>
      <div style={{ position: "relative" }}>
        {icon && (
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}>
            {icon}
          </span>
        )}
        <input
          type={type} name={name} value={value} onChange={onChange}
          placeholder={placeholder} required={required}
          style={{
            width: "100%", padding: icon ? "10px 12px 10px 36px" : "10px 12px",
            border: `1px solid ${T.border}`, borderRadius: 7,
            fontSize: 14, fontFamily: font.body, background: T.white,
            color: T.text, outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = T.teal}
          onBlur={e => e.target.style.borderColor = T.border}
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

// ─── Stage form panels ────────────────────────────────────────────────────────
function StageAgreement({ form, setForm, ownedParcels }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  return (
    <>
      <Alert type="info">
        Select the parcel you wish to transfer. The parcel must be ACTIVE with no active encumbrances.
      </Alert>
      <SelectField label="Select Parcel" name="parcelId" value={form.parcelId} onChange={set("parcelId")}
        options={[
          { value: "", label: "— Choose a parcel —" },
          ...ownedParcels.map(p => ({
            value: p.parcelId,
            label: `${p.titleNumber} — ${p.county}, ${p.areaHectares} ha (${p.status})`,
          })),
        ]}
        required
      />
      {form.parcelId && (
        <div style={{ background: T.bg, borderRadius: 8, padding: 14, marginBottom: 16 }}>
          {[["County","Nakuru"],["Area","0.25 ha"],["Land Use","Residential"],["Encumbrances","None"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
              <span style={{ color: T.textMuted }}>{k}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <FormField label="Buyer National ID" name="buyerNationalId" value={form.buyerNationalId || ""} onChange={set("buyerNationalId")} placeholder="12345678" required icon="🪪" />
        <FormField label="Buyer Full Name" name="buyerName" value={form.buyerName || ""} onChange={set("buyerName")} placeholder="Jane Wanjiku" required />
      </div>
      <SelectField label="Transfer Type" name="transferType" value={form.transferType} onChange={set("transferType")}
        options={[
          { value: "SALE", label: "Sale" },
          { value: "GIFT", label: "Gift" },
          { value: "INHERITANCE", label: "Inheritance" },
          { value: "COURT_ORDER", label: "Court Order" },
        ]}
        required
      />
      {form.transferType === "SALE" && (
        <FormField label="Sale Price (KES)" name="salePriceKES" type="number" value={form.salePriceKES || ""} onChange={set("salePriceKES")} placeholder="e.g. 2,500,000" required icon="💰" />
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.textMid, marginBottom:5 }}>
          Upload Sale Agreement PDF <span style={{ color: T.textMuted }}>(optional)</span>
        </label>
        <div style={{ border:`2px dashed ${T.border}`, borderRadius:8, padding:"20px 16px", textAlign:"center", cursor:"pointer", background: form.agreementFile ? T.successLt : T.white }}>
          <input type="file" accept=".pdf,.jpg,.png" style={{ display:"none" }} id="agreement-file" onChange={e => setForm(p => ({ ...p, agreementFile: e.target.files[0] }))} />
          <label htmlFor="agreement-file" style={{ cursor:"pointer" }}>
            <span style={{ fontSize:24, display:"block", marginBottom:6 }}>{form.agreementFile ? "📄" : "📂"}</span>
            <p style={{ fontSize:13, color: form.agreementFile ? T.success : T.textMuted }}>
              {form.agreementFile ? form.agreementFile.name : "Click to upload (PDF, JPG, PNG · max 10MB)"}
            </p>
          </label>
        </div>
        <p style={{ fontSize:11, color:T.textMuted, marginTop:5 }}>File will be stored on IPFS — CID anchored on the blockchain.</p>
      </div>
    </>
  );
}

function StageLCB({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  return (
    <>
      <Alert type="warn">
        This parcel is classified as Agricultural land. The Land Control Board must grant consent before the transfer can proceed. LCB meets on the first Saturday of each month.
      </Alert>
      <FormField label="Scheduled LCB Meeting Date" name="lcbDate" type="date" value={form.lcbDate || ""} onChange={set("lcbDate")} required />
      <FormField label="LCB Zone / Sub-County" name="lcbZone" value={form.lcbZone || ""} onChange={set("lcbZone")} placeholder="e.g. Nakuru East Sub-County" required />
      <SelectField label="LCB Outcome" name="lcbStatus" value={form.lcbStatus || "PENDING"}
        onChange={set("lcbStatus")}
        options={[
          { value: "PENDING", label: "Awaiting hearing" },
          { value: "GRANTED", label: "Consent granted" },
          { value: "REFUSED", label: "Consent refused" },
        ]}
      />
      {form.lcbStatus === "GRANTED" && (
        <>
          <FormField label="LCB Chairman Name" name="lcbChairman" value={form.lcbChairman || ""} onChange={set("lcbChairman")} placeholder="Full name of presiding chairman" required />
          <FormField label="Consent Certificate Number" name="lcbCertNo" value={form.lcbCertNo || ""} onChange={set("lcbCertNo")} placeholder="LCB/NKR/2025/001" required icon="📜" />
        </>
      )}
      {form.lcbStatus === "REFUSED" && (
        <>
          <Alert type="danger">Consent refusal will cancel this transfer. The reason must be recorded.</Alert>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.textMid, marginBottom:5 }}>Refusal Reason <span style={{ color:T.danger }}>*</span></label>
            <textarea value={form.lcbRefusalReason || ""} onChange={e => setForm(p => ({ ...p, lcbRefusalReason: e.target.value }))}
              placeholder="State the grounds for refusal as recorded in the LCB minutes…"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${T.danger}`, borderRadius:7, fontSize:14, fontFamily:font.body, minHeight:80, resize:"vertical" }} />
          </div>
        </>
      )}
    </>
  );
}

function StageValuation({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const URBAN = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Kiambu","Thika"];
  const isUrban = form.county && URBAN.includes(form.county);
  const rate = isUrban ? 0.04 : 0.02;
  const valNum = parseFloat((form.valuationKES || "0").toString().replace(/,/g, ""));
  const expectedDuty = isNaN(valNum) ? 0 : Math.round(valNum * rate);
  const submittedDuty = parseFloat((form.stampDutyKES || "0").toString().replace(/,/g, ""));
  const dutyShortfall = submittedDuty < expectedDuty ? expectedDuty - submittedDuty : 0;

  return (
    <>
      <Alert type="info">
        Stamp duty rate: <strong>{(rate * 100).toFixed(0)}%</strong> ({isUrban ? "urban/township" : "rural"} rate for {form.county || "this county"}). Expected stamp duty will be automatically calculated.
      </Alert>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <FormField label="Government Valuation (KES)" name="valuationKES" type="number" value={form.valuationKES || ""} onChange={set("valuationKES")} placeholder="e.g. 2500000" required icon="📊" />
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.textMid, marginBottom:5 }}>Expected Stamp Duty</label>
          <div style={{ padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, fontSize:14, fontFamily:font.mono, color:T.navy, fontWeight:600 }}>
            KES {expectedDuty.toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <FormField label="Stamp Duty Paid (KES)" name="stampDutyKES" type="number" value={form.stampDutyKES || ""} onChange={set("stampDutyKES")} placeholder={expectedDuty.toString()} required icon="🧾" />
        <FormField label="KRA Receipt Number" name="stampDutyReceipt" value={form.stampDutyReceipt || ""} onChange={set("stampDutyReceipt")} placeholder="KRA/SD/2025/XXXXXXX" required icon="📋" />
      </div>
      {dutyShortfall > 0 && (
        <Alert type="danger">
          Stamp duty shortfall of <strong>KES {dutyShortfall.toLocaleString()}</strong>. The submitted amount is below the required {(rate*100).toFixed(0)}% of the declared valuation. Approval will be blocked.
        </Alert>
      )}
      <FormField label="Government Valuer Name" name="valuatorName" value={form.valuatorName || ""} onChange={set("valuatorName")} placeholder="Name of Chief Government Valuer or approved private valuer" />
      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.textMid, marginBottom:5 }}>Upload Valuation Certificate</label>
        <div style={{ border:`2px dashed ${T.border}`, borderRadius:8, padding:"16px", textAlign:"center", cursor:"pointer" }}>
          <input type="file" accept=".pdf" style={{ display:"none" }} id="val-cert" onChange={e => setForm(p => ({ ...p, valuationCert: e.target.files[0] }))} />
          <label htmlFor="val-cert" style={{ cursor:"pointer", fontSize:13, color: form.valuationCert ? T.success : T.textMuted }}>
            {form.valuationCert ? `✓  ${form.valuationCert.name}` : "📄  Click to upload valuation certificate (PDF)"}
          </label>
        </div>
      </div>
    </>
  );
}

function StageDocuments({ form, setForm }) {
  const DOCS = [
    { key: "titleDeed",       label: "Original Title Deed",             required: true },
    { key: "buyerID",         label: "Buyer National ID / Passport",    required: true },
    { key: "sellerID",        label: "Seller National ID / Passport",   required: true },
    { key: "buyerKraPin",     label: "Buyer KRA PIN Certificate",       required: true },
    { key: "sellerKraPin",    label: "Seller KRA PIN Certificate",      required: true },
    { key: "landRentClear",   label: "Land Rent Clearance Certificate", required: true },
    { key: "ratesClear",      label: "County Rates Clearance",          required: true },
    { key: "consentForm",     label: "Signed Transfer Consent Form",    required: false },
  ];

  return (
    <>
      <Alert type="info">
        All documents will be uploaded to IPFS. Their content hashes will be anchored to the blockchain as part of this transfer record. Ensure all files are clear, legible scans.
      </Alert>
      {DOCS.map(doc => (
        <div key={doc.key} style={{
          display:"flex", alignItems:"center", gap:12,
          padding:"12px 14px", marginBottom:8,
          border:`1px solid ${form[doc.key] ? T.success : T.border}`,
          borderRadius:8, background: form[doc.key] ? T.successLt : T.white,
          transition:"all 0.2s",
        }}>
          <div style={{ width:32, height:32, borderRadius:8, background: form[doc.key] ? T.success : T.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
            {form[doc.key] ? <span style={{ color:"#fff", fontSize:14 }}>✓</span> : "📄"}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:500, color: form[doc.key] ? T.success : T.text }}>
              {doc.label}
              {doc.required && <span style={{ color:T.danger, fontSize:11 }}> *</span>}
            </p>
            {form[doc.key] && <p style={{ fontSize:11, color:T.success, marginTop:2 }}>{form[doc.key].name}</p>}
          </div>
          <div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} id={`doc-${doc.key}`}
              onChange={e => setForm(p => ({ ...p, [doc.key]: e.target.files[0] }))} />
            <label htmlFor={`doc-${doc.key}`} style={{
              padding:"6px 14px", borderRadius:6, fontSize:12, fontWeight:500,
              border:`1px solid ${form[doc.key] ? T.success : T.border}`,
              background: T.white, color: form[doc.key] ? T.success : T.textMid,
              cursor:"pointer", whiteSpace:"nowrap",
            }}>
              {form[doc.key] ? "Replace" : "Upload"}
            </label>
          </div>
        </div>
      ))}
      <div style={{ marginTop:14, padding:"12px 14px", background:T.bg, borderRadius:8 }}>
        <p style={{ fontSize:12, color:T.textMuted }}>
          {DOCS.filter(d => form[d.key]).length} / {DOCS.length} documents uploaded
          {" · "}{DOCS.filter(d => d.required && !form[d.key]).length} required documents remaining
        </p>
        <div style={{ height:6, background:T.border, borderRadius:3, marginTop:8, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${(DOCS.filter(d => form[d.key]).length / DOCS.length) * 100}%`, background:`linear-gradient(90deg, ${T.teal}, #0FA896)`, borderRadius:3, transition:"width 0.4s ease" }} />
        </div>
      </div>
    </>
  );
}

function StageExecution({ form, setForm }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  return (
    <>
      <Alert type="info">
        Under Kenyan law, the transfer instrument must be signed before a Commissioner for Oaths or a practicing advocate. Record the execution details below.
      </Alert>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <FormField label="Date of Execution" name="executionDate" type="date" value={form.executionDate || ""} onChange={set("executionDate")} required />
        <FormField label="Place of Execution" name="executionPlace" value={form.executionPlace || ""} onChange={set("executionPlace")} placeholder="e.g. Nakuru Law Courts" required icon="📍" />
      </div>
      <FormField label="Commissioner for Oaths / Advocate Name" name="commissionerName" value={form.commissionerName || ""} onChange={set("commissionerName")} placeholder="Full name" required icon="⚖" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <FormField label="Licence / Roll Number" name="commissionerLicenseNo" value={form.commissionerLicenseNo || ""} onChange={set("commissionerLicenseNo")} placeholder="LSK Roll No. / Comm. No." required icon="🪪" />
        <FormField label="Contact Phone" name="commissionerPhone" value={form.commissionerPhone || ""} onChange={set("commissionerPhone")} placeholder="+254 7XX XXX XXX" />
      </div>
      <div style={{ padding:"14px", background:T.bg, borderRadius:8, marginBottom:16 }}>
        <p style={{ fontSize:12, fontWeight:500, color:T.navy, marginBottom:8 }}>Execution Confirmation</p>
        {[
          ["Seller", form.sellerName || "—"],
          ["Buyer",  form.buyerName  || "—"],
          ["Parcel", form.titleNumber || form.parcelId || "—"],
          ["Date",   form.executionDate || "Not recorded"],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
            <span style={{ color:T.textMuted }}>{k}</span>
            <span style={{ fontWeight:500 }}>{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function StageRegistration({ form, transferData, onApprove, onReject, role }) {
  const [reason, setReason] = useState("");
  const isRegistrar = role === "REGISTRAR";

  return (
    <>
      {isRegistrar ? (
        <Alert type="warn">
          Review all details carefully. Approval will atomically commit this transfer to the Hyperledger Fabric ledger and update the MySQL record. This action cannot be undone.
        </Alert>
      ) : (
        <Alert type="info">
          Your transfer has been submitted for Registrar approval. You will be notified by email once a decision is made.
        </Alert>
      )}
      <div style={{ background:T.bg, borderRadius:10, padding:16, marginBottom:16 }}>
        <p style={{ fontSize:12, fontWeight:600, color:T.navy, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Transfer Summary</p>
        {[
          ["Transfer ID",    transferData?.transferId || "—"],
          ["Parcel",         form.titleNumber || form.parcelId || "—"],
          ["From",           form.sellerName || "—"],
          ["To",             form.buyerName  || "—"],
          ["Type",           form.transferType || "—"],
          ["Sale Price",     form.salePriceKES ? `KES ${Number(form.salePriceKES).toLocaleString()}` : "—"],
          ["Valuation",      form.valuationKES  ? `KES ${Number(form.valuationKES).toLocaleString()}`  : "—"],
          ["Stamp Duty Paid",form.stampDutyKES  ? `KES ${Number(form.stampDutyKES).toLocaleString()}`  : "—"],
          ["Executed",       form.executionDate || "—"],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
            <span style={{ color:T.textMuted }}>{k}</span>
            <span style={{ fontWeight:500, fontFamily: k === "Transfer ID" ? font.mono : font.body, fontSize: k === "Transfer ID" ? 12 : 13, color: k === "Transfer ID" ? T.teal : T.text }}>{v}</span>
          </div>
        ))}
      </div>

      {isRegistrar && (
        <>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.textMid, marginBottom:5 }}>Registrar Notes (required for rejection)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Enter grounds for rejection if applicable…"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${T.border}`, borderRadius:7, fontSize:13, fontFamily:font.body, minHeight:72, resize:"vertical" }} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => onReject(reason)} style={{
              flex:1, padding:"11px", borderRadius:7, fontFamily:font.body,
              fontWeight:500, fontSize:14, cursor:"pointer",
              background:T.dangerLt, color:T.danger, border:`1px solid ${T.danger}40`,
              transition:"all 0.15s",
            }}>✕ Reject Transfer</button>
            <button onClick={onApprove} style={{
              flex:1, padding:"11px", borderRadius:7, fontFamily:font.body,
              fontWeight:600, fontSize:14, cursor:"pointer",
              background:T.teal, color:"#fff", border:`1px solid ${T.teal}`,
              transition:"all 0.15s",
            }}>✓ Approve &amp; Commit to Blockchain</button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Vertical Progress Rail ───────────────────────────────────────────────────
function ProgressRail({ stages, activeIdx, completedUpTo, landUse }) {
  return (
    <div style={{ width: 220, flexShrink: 0 }}>
      <div style={{ position: "sticky", top: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>Transfer Progress</p>
        <div style={{ position: "relative" }}>
          {/* Vertical spine */}
          <div style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 2, background: T.border, zIndex: 0 }} />
          {/* Filled portion */}
          <div style={{
            position: "absolute", left: 15, top: 8, width: 2, zIndex: 1,
            height: `${Math.max(0, (completedUpTo / (stages.length - 1)) * 100)}%`,
            background: `linear-gradient(180deg, ${T.teal} 0%, ${T.tealMid} 100%)`,
            transition: "height 0.5s ease",
          }} />

          {stages.map((stage, i) => {
            const isActive    = i === activeIdx;
            const isCompleted = i < completedUpTo;
            const isLocked    = stage.conditionalOn && landUse !== stage.conditionalOn;
            const isSkipped   = isLocked;

            return (
              <div key={stage.id} style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "flex-start", gap: 14, marginBottom: i < stages.length - 1 ? 24 : 0 }}>
                {/* Node */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isCompleted ? 14 : 13,
                  fontWeight: 600,
                  background: isCompleted ? T.teal : isActive ? T.navy : isSkipped ? T.bg : T.white,
                  border: `2px solid ${isCompleted ? T.teal : isActive ? T.navy : isSkipped ? T.border : T.border}`,
                  color: isCompleted ? "#fff" : isActive ? "#fff" : isSkipped ? T.textMuted : T.textMuted,
                  boxShadow: isActive ? `0 0 0 4px ${T.navy}18` : "none",
                  transition: "all 0.25s ease",
                }}>
                  {isCompleted ? "✓" : isSkipped ? "–" : i + 1}
                </div>

                {/* Label */}
                <div style={{ paddingTop: 5 }}>
                  <p style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isCompleted ? T.teal : isActive ? T.navy : isSkipped ? T.textMuted : T.textMid,
                    lineHeight: 1.3, transition: "color 0.2s",
                  }}>{stage.shortLabel}</p>
                  {isActive && (
                    <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{stage.time}</p>
                  )}
                  {isSkipped && (
                    <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontStyle: "italic" }}>N/A for this parcel</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall completion */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:T.textMuted }}>Overall progress</span>
            <span style={{ fontSize:11, fontWeight:600, color:T.navy }}>{Math.round((completedUpTo / stages.length) * 100)}%</span>
          </div>
          <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{
              height:"100%", borderRadius:3,
              width:`${(completedUpTo / stages.length) * 100}%`,
              background:`linear-gradient(90deg, ${T.teal} 0%, ${T.tealMid} 100%)`,
              transition:"width 0.5s ease",
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({ txId, form, onReset }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: T.successLt, border: `2px solid ${T.success}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: 32,
        animation: "scaleIn 0.4s ease",
      }}>✓</div>
      <h2 style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700, color: T.navy, marginBottom: 8 }}>
        Transfer Approved
      </h2>
      <p style={{ color: T.textMuted, fontSize: 15, marginBottom: 24 }}>
        The ownership transfer has been committed to the Hyperledger Fabric ledger.
      </p>
      <div style={{ background: T.bg, borderRadius: 10, padding: 20, maxWidth: 440, margin: "0 auto 28px", textAlign: "left" }}>
        {[
          ["Parcel", form.titleNumber || form.parcelId],
          ["New Owner", form.buyerName],
          ["Blockchain TX", txId],
        ].map(([k,v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
            <span style={{ color:T.textMuted }}>{k}</span>
            <span style={{ fontFamily: k === "Blockchain TX" ? font.mono : font.body, fontSize: k === "Blockchain TX" ? 11 : 13, fontWeight:500, color: k === "Blockchain TX" ? T.teal : T.text }}>{v || "—"}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
        <button onClick={onReset} style={{ padding:"10px 24px", borderRadius:7, fontFamily:font.body, fontWeight:500, fontSize:14, cursor:"pointer", border:`1px solid ${T.border}`, background:T.white, color:T.navy }}>
          New Transfer
        </button>
        <Link to="/dashboard" style={{ padding:"10px 24px", borderRadius:7, fontFamily:font.body, fontWeight:500, fontSize:14, textDecoration:"none", background:T.navy, color:"#fff", display:"inline-block" }}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandTransfer() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [activeStage,  setActiveStage]  = useState(0);
  const [completedUpTo,setCompletedUpTo]= useState(0);
  const [form,         setForm]         = useState({
    parcelId: "", transferType: "SALE", buyerNationalId: "", buyerName: "",
    salePriceKES: "", agreementFile: null,
    lcbDate: "", lcbZone: "", lcbStatus: "PENDING",
    valuationKES: "", stampDutyKES: "", stampDutyReceipt: "",
    executionDate: "", commissionerName: "", commissionerLicenseNo: "",
    county: "Nakuru", landUse: "RESIDENTIAL",
  });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [transferData, setTransferData] = useState(null);
  const [done,         setDone]         = useState(false);
  const [txId,         setTxId]         = useState("");
  const contentRef = useRef(null);

  // Demo owned parcels
  const ownedParcels = [
    { parcelId: "a1b2", titleNumber: "KE/NKR/2024/0042", county: "Nakuru",  areaHectares: 0.25, landUseType: "RESIDENTIAL",  status: "ACTIVE" },
    { parcelId: "b2c3", titleNumber: "KE/MOM/2023/0180", county: "Mombasa", areaHectares: 1.80, landUseType: "AGRICULTURAL", status: "ACTIVE" },
  ];

  const selectedParcel = ownedParcels.find(p => p.parcelId === form.parcelId);
  const landUse = selectedParcel?.landUseType || form.landUse;

  const visibleStages = STAGES.filter(s => {
    if (s.conditionalOn && landUse !== s.conditionalOn) return false;
    return true;
  });

  const scrollToContent = () => {
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleNext = async () => {
    setError("");
    const stage = visibleStages[activeStage];

    if (stage.id === "agreement") {
      if (!form.parcelId || !form.transferType || !form.buyerNationalId || !form.buyerName) {
        setError("Please complete all required fields before continuing.");
        return;
      }
      setLoading(true);
      try {
        await new Promise(r => setTimeout(r, 600)); // simulate API
        setTransferData({ transferId: `TC-${Date.now()}` });
      } catch {
        setError("Failed to initiate transfer. Please try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    if (stage.id === "lcb") {
      if (form.lcbStatus === "REFUSED") {
        setError("LCB consent was refused. This transfer cannot proceed. Please contact the Land Control Board.");
        return;
      }
    }

    if (stage.id === "valuation") {
      const rate     = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret"].includes(form.county) ? 0.04 : 0.02;
      const valNum   = parseFloat((form.valuationKES || "0").toString().replace(/,/g, ""));
      const expected = Math.round(valNum * rate);
      const paid     = parseFloat((form.stampDutyKES || "0").toString().replace(/,/g, ""));
      if (!form.valuationKES || !form.stampDutyReceipt) {
        setError("Please enter the valuation amount and KRA receipt number.");
        return;
      }
      if (paid < expected) {
        setError(`Stamp duty shortfall of KES ${(expected - paid).toLocaleString()}. Correct before proceeding.`);
        return;
      }
    }

    if (stage.id === "execution") {
      if (!form.executionDate || !form.commissionerName || !form.commissionerLicenseNo) {
        setError("Please complete all execution details.");
        return;
      }
    }

    setCompletedUpTo(prev => Math.max(prev, activeStage + 1));
    setActiveStage(prev => Math.min(prev + 1, visibleStages.length - 1));
    scrollToContent();
  };

  const handlePrev = () => {
    setError("");
    setActiveStage(prev => Math.max(prev - 1, 0));
    scrollToContent();
  };

  const handleApprove = async () => {
    setLoading(true);
    setError("");
    try {
      await new Promise(r => setTimeout(r, 1200)); // simulate Fabric TX
      setTxId(`0x${Math.random().toString(16).slice(2,18).toUpperCase()}`);
      setDone(true);
    } catch {
      setError("Blockchain commit failed. Please retry.");
    }
    setLoading(false);
  };

  const handleReject = async (reason) => {
    if (!reason.trim()) { setError("Please provide a rejection reason."); return; }
    alert(`Transfer rejected. Reason: ${reason}`);
    navigate("/registrar/queue");
  };

  const handleReset = () => {
    setActiveStage(0);
    setCompletedUpTo(0);
    setForm({ parcelId:"", transferType:"SALE", buyerNationalId:"", buyerName:"", salePriceKES:"", agreementFile:null, lcbDate:"", lcbZone:"", lcbStatus:"PENDING", valuationKES:"", stampDutyKES:"", stampDutyReceipt:"", executionDate:"", commissionerName:"", commissionerLicenseNo:"", county:"Nakuru", landUse:"RESIDENTIAL" });
    setTransferData(null);
    setDone(false);
    setTxId("");
    setError("");
  };

  const currentStage = visibleStages[activeStage];
  const isLastStage = activeStage === visibleStages.length - 1;
  const isFirstStage = activeStage === 0;

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

      {/* Page header */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy} 0%, ${T.navyMid} 100%)`,
        padding: "28px 32px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:260, opacity:0.05, backgroundImage:"repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize:"18px 18px" }} />
        <div style={{ position:"relative", maxWidth:1100, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Link to="/dashboard" style={{ color:"#64748B", fontSize:13, textDecoration:"none" }}>
              ← Dashboard
            </Link>
            <span style={{ color:"#3D5070", fontSize:13 }}>›</span>
            <span style={{ color:"#94A3B8", fontSize:13 }}>Land Transfer</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:16 }}>
            <div>
              <h1 style={{ fontFamily:font.head, fontSize:26, fontWeight:700, color:"#fff", marginBottom:5 }}>
                Ownership Transfer
              </h1>
              <p style={{ color:"#94A3B8", fontSize:13 }}>
                Kenya Land Registration Act 2012 · Blockchain-secured · Hyperledger Fabric 2.5
              </p>
            </div>
            {transferData && (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <StatusPill status={
                  activeStage === 0 ? "PENDING" :
                  activeStage === 1 && landUse === "AGRICULTURAL" ? "AWAITING_LCB_CONSENT" :
                  activeStage === 2 ? "AWAITING_VALUATION" :
                  activeStage === 3 ? "AWAITING_DOCUMENTS" :
                  activeStage === 4 ? "AWAITING_APPROVAL" :
                  done ? "APPROVED" : "AWAITING_APPROVAL"
                } />
                <span style={{ fontFamily:font.mono, fontSize:11, color:"#64748B" }}>
                  {transferData.transferId}
                </span>
              </div>
            )}
          </div>

          {/* Horizontal mini progress for mobile */}
          <div style={{ display:"flex", gap:6, marginTop:20, alignItems:"center" }}>
            {visibleStages.map((s, i) => (
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{
                  width: i === activeStage ? "auto" : 28,
                  minWidth: 28, height:6, borderRadius:3,
                  background: i < completedUpTo ? T.teal : i === activeStage ? "#fff" : "rgba(255,255,255,0.15)",
                  padding: i === activeStage ? "0 10px" : 0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:10, color:T.navy, fontWeight:600,
                  transition:"all 0.3s ease",
                }}>
                  {i === activeStage ? s.shortLabel : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        {done ? (
          <div style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:12, padding:24, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <SuccessScreen txId={txId} form={form} onReset={handleReset} />
          </div>
        ) : (
          <div style={{ display:"flex", gap:28, alignItems:"flex-start" }}>

            {/* ── Left: Progress rail ─────────────────────────────── */}
            <ProgressRail
              stages={visibleStages}
              activeIdx={activeStage}
              completedUpTo={completedUpTo}
              landUse={landUse}
            />

            {/* ── Right: Stage content ────────────────────────────── */}
            <div style={{ flex:1, minWidth:0 }} ref={contentRef}>
              {/* Stage header card */}
              <div style={{
                background:T.white, border:`1px solid ${T.border}`,
                borderRadius:12, overflow:"hidden",
                boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                marginBottom:16,
              }}>
                <div style={{
                  padding:"18px 24px",
                  borderBottom:`1px solid ${T.border}`,
                  background:`linear-gradient(135deg, ${T.navy}08 0%, transparent 100%)`,
                }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                    <div style={{
                      width:44, height:44, borderRadius:10,
                      background:`${T.navy}12`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:20, flexShrink:0,
                    }}>{currentStage.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <h2 style={{ fontFamily:font.head, fontSize:18, fontWeight:600, color:T.navy }}>
                          {currentStage.label}
                        </h2>
                        <span style={{ fontSize:11, color:T.textMuted, background:T.bg, padding:"2px 9px", borderRadius:10 }}>
                          Step {activeStage + 1} of {visibleStages.length}
                        </span>
                      </div>
                      <p style={{ fontSize:13, color:T.textMuted, marginTop:3 }}>
                        {currentStage.description}
                      </p>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ fontSize:11, color:T.textMuted }}>Typical time</p>
                      <p style={{ fontSize:13, fontWeight:600, color:T.navy, marginTop:2 }}>{currentStage.time}</p>
                      <p style={{ fontSize:10, color:T.textMuted, marginTop:4, fontFamily:font.mono }}>{currentStage.law}</p>
                    </div>
                  </div>
                </div>

                {/* Form content */}
                <div style={{ padding:"22px 24px" }} className="stage-content" key={activeStage}>
                  {error && <Alert type="danger">{error}</Alert>}

                  {currentStage.id === "agreement"    && <StageAgreement form={form} setForm={setForm} ownedParcels={ownedParcels} />}
                  {currentStage.id === "lcb"          && <StageLCB form={form} setForm={setForm} />}
                  {currentStage.id === "valuation"    && <StageValuation form={form} setForm={setForm} />}
                  {currentStage.id === "documents"    && <StageDocuments form={form} setForm={setForm} />}
                  {currentStage.id === "execution"    && <StageExecution form={form} setForm={setForm} />}
                  {currentStage.id === "registration" && (
                    <StageRegistration
                      form={form} transferData={transferData}
                      onApprove={handleApprove} onReject={handleReject}
                      role={role}
                    />
                  )}
                </div>
              </div>

              {/* Navigation buttons */}
              {currentStage.id !== "registration" && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <button onClick={handlePrev} disabled={isFirstStage || loading} style={{
                    padding:"10px 22px", borderRadius:7, fontFamily:font.body,
                    fontWeight:500, fontSize:14, cursor: isFirstStage ? "not-allowed" : "pointer",
                    border:`1px solid ${T.border}`, background:T.white, color:T.navy,
                    opacity: isFirstStage ? 0.4 : 1, transition:"all 0.15s",
                  }}>← Previous</button>

                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {visibleStages.map((s,i) => (
                      <div key={s.id} style={{
                        width: i === activeStage ? 20 : 6,
                        height:6, borderRadius:3,
                        background: i < completedUpTo ? T.teal : i === activeStage ? T.navy : T.border,
                        transition:"all 0.3s ease",
                      }} />
                    ))}
                  </div>

                  <button
                    onClick={handleNext} disabled={loading}
                    className="next-btn"
                    style={{
                      padding:"10px 28px", borderRadius:7, fontFamily:font.body,
                      fontWeight:600, fontSize:14, cursor: loading ? "not-allowed" : "pointer",
                      background:T.navy, color:"#fff", border:`1px solid ${T.navy}`,
                      opacity: loading ? 0.7 : 1,
                    }}>
                    {loading ? "Processing…" : isLastStage ? "Submit for Approval" : "Continue →"}
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