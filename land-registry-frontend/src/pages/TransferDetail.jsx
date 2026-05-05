import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { transfersApi } from "../api/services";
import { Breadcrumb } from "../components/ui/Feedback";
import { C, font } from "../styles/tokens";

// ─── tiny design tokens ───────────────────────────────────────────────────────
const T = {
  radius:   10,
  shadow:   "0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)",
  shadowMd: "0 2px 8px rgba(0,0,0,.10), 0 8px 32px rgba(0,0,0,.06)",
};

// ─── status catalogue ─────────────────────────────────────────────────────────
// Flow:
//   PENDING_BUYER_APPROVAL → PENDING_SURVEY (surveyor mutation form)
//   → PENDING_ADVOCATE_DOCS (advocate legal agreement)
//   → PENDING_CLERK_VERIFICATION → PENDING_LCB_APPROVAL (agric only)
//   → PENDING_COUNTY_RATES → PENDING_VALUATION
//   → PENDING_STAMP_DUTY → PENDING_REGISTRAR_APPROVAL → APPROVED
const STATUS_META = {
  PENDING_BUYER_APPROVAL:       { label: "Awaiting Buyer Approval",    color: "#f59e0b", bg: "#fffbeb", step: 1 },
  BUYER_REJECTED:               { label: "Rejected by Buyer",          color: "#ef4444", bg: "#fef2f2", step: 1 },
  PENDING_SURVEY:               { label: "Awaiting Mutation Form",     color: "#06b6d4", bg: "#ecfeff", step: 2 },
  PENDING_ADVOCATE_DOCS:        { label: "Awaiting Legal Documents",   color: "#8b5cf6", bg: "#f5f3ff", step: 3 },
  PENDING_CLERK_VERIFICATION:   { label: "Under Clerk Review",         color: "#3b82f6", bg: "#eff6ff", step: 4 },
  PENDING_LCB_APPROVAL:         { label: "Awaiting LCB Approval",      color: "#10b981", bg: "#ecfdf5", step: 5 },
  PENDING_COUNTY_RATES:         { label: "Awaiting Rates Clearance",   color: "#f97316", bg: "#fff7ed", step: 6 },
  PENDING_VALUATION:            { label: "Awaiting Valuation",         color: "#6366f1", bg: "#eef2ff", step: 7 },
  PENDING_STAMP_DUTY:           { label: "Awaiting Stamp Duty",        color: "#ec4899", bg: "#fdf2f8", step: 8 },
  PENDING_REGISTRAR_APPROVAL:   { label: "Awaiting Final Approval",    color: "#0ea5e9", bg: "#f0f9ff", step: 9 },
  APPROVED:                     { label: "Approved — Title Issued",    color: "#10b981", bg: "#ecfdf5", step: 10 },
  REJECTED:                     { label: "Rejected",                   color: "#ef4444", bg: "#fef2f2", step: 10 },
  CANCELLED:                    { label: "Cancelled",                  color: "#9ca3af", bg: "#f9fafb", step: 10 },
};

const STEPS = [
  { key: "PENDING_BUYER_APPROVAL",     short: "Buyer",     label: "Buyer Approval"   },
  { key: "PENDING_SURVEY",             short: "Survey",    label: "Mutation Form"    },
  { key: "PENDING_ADVOCATE_DOCS",      short: "Advocate",  label: "Legal Docs"       },
  { key: "PENDING_CLERK_VERIFICATION", short: "Clerk",     label: "Doc Verification" },
  { key: "PENDING_LCB_APPROVAL",       short: "LCB",       label: "LCB Approval"     },
  { key: "PENDING_COUNTY_RATES",       short: "Rates",     label: "Rates Clearance"  },
  { key: "PENDING_VALUATION",          short: "Valuation", label: "Valuation"        },
  { key: "PENDING_STAMP_DUTY",         short: "Stamp",     label: "Stamp Duty"       },
  { key: "PENDING_REGISTRAR_APPROVAL", short: "Registrar", label: "Final Approval"   },
  { key: "APPROVED",                   short: "Title",     label: "Title Issued"     },
];

const DOC_ROLE_LABELS = {
  mutation_form:    "Mutation Form",
  agreement:        "Transfer / Sale Agreement",
  consideration:    "Proof of Consideration",
  supporting:       "Supporting Document",
  stamp_duty_proof: "Stamp Duty Proof",
};
const DOC_ROLE_ICONS = {
  mutation_form:    "📐",
  agreement:        "📋",
  consideration:    "💳",
  supporting:       "📎",
  stamp_duty_proof: "🧾",
};

// ─── reusable atoms ───────────────────────────────────────────────────────────
function Field({ label, value, mono }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: ".06em", color: C.textSecondary, marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 500, color: C.navy,
                  fontFamily: mono ? "monospace" : undefined,
                  wordBreak: mono ? "break-all" : undefined, margin: 0 }}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function SectionCard({ title, icon, children, accent, style: extraStyle }) {
  return (
    <div style={{
      background: "#fff", borderRadius: T.radius, boxShadow: T.shadow,
      marginBottom: 16, overflow: "hidden",
      border: accent ? `1.5px solid ${accent}` : "1px solid #f1f5f9",
      ...extraStyle,
    }}>
      {title && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9",
                      display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
          <p style={{ fontSize: 13, fontWeight: 700, color: C.navy,
                      textTransform: "uppercase", letterSpacing: ".05em", margin: 0 }}>
            {title}
          </p>
        </div>
      )}
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, loading, full, small, danger }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: small ? "7px 14px" : "10px 20px",
    borderRadius: 8, fontWeight: 600, fontSize: small ? 12 : 14,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "none", transition: "all .15s", width: full ? "100%" : undefined,
    opacity: disabled || loading ? .55 : 1,
  };
  const styles = {
    primary:   { background: C.primary, color: "#fff" },
    secondary: { background: "#f1f5f9", color: C.navy },
    danger:    { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" },
    success:   { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" },
    ghost:     { background: "transparent", color: C.primary, border: `1px solid ${C.primary}40` },
  };
  return (
    <button onClick={!disabled && !loading ? onClick : undefined}
      style={{ ...base, ...(danger ? styles.danger : styles[variant] || styles.primary) }}>
      {loading ? "…" : children}
    </button>
  );
}

function AlertBox({ type = "info", children }) {
  const map = {
    info:    { bg: "#eff6ff", color: "#1d4ed8", icon: "ℹ️" },
    warn:    { bg: "#fffbeb", color: "#b45309", icon: "⚠️" },
    success: { bg: "#ecfdf5", color: "#065f46", icon: "✅" },
    danger:  { bg: "#fef2f2", color: "#b91c1c", icon: "🚫" },
  };
  const s = map[type] || map.info;
  return (
    <div style={{ background: s.bg, color: s.color, borderRadius: 8,
                  padding: "10px 14px", fontSize: 13, marginBottom: 14,
                  display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span>{s.icon}</span><span>{children}</span>
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, required, rows = 3 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600,
                        color: C.navy, marginBottom: 5,
                        textTransform: "uppercase", letterSpacing: ".04em" }}>
          {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, resize: "vertical",
                 border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
                 outline: "none", boxSizing: "border-box", color: C.navy }} />
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", required, helper }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600,
                        color: C.navy, marginBottom: 5,
                        textTransform: "uppercase", letterSpacing: ".04em" }}>
          {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box",
                 border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
                 outline: "none", color: C.navy }} />
      {helper && <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>{helper}</p>}
    </div>
  );
}

function FileUpload({ label, file, onChange, accept = ".pdf,.jpg,.jpeg,.png", required, helper }) {
  const ref = useRef();
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600,
                        color: C.navy, marginBottom: 5,
                        textTransform: "uppercase", letterSpacing: ".04em" }}>
          {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div onClick={() => ref.current.click()} style={{
        border: `2px dashed ${file ? C.primary : "#cbd5e1"}`, borderRadius: 8,
        padding: "12px 14px", cursor: "pointer",
        background: file ? `${C.primary}08` : "#f8fafc",
        display: "flex", alignItems: "center", gap: 10, transition: "all .2s",
      }}>
        <span style={{ fontSize: 18 }}>{file ? "📄" : "📁"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, margin: 0,
                      color: file ? C.primary : C.textSecondary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file ? file.name : "Click to upload"}
          </p>
          {file && <p style={{ fontSize: 11, color: C.textSecondary, margin: 0 }}>
            {(file.size / 1024).toFixed(1)} KB
          </p>}
        </div>
        {file && (
          <button onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ background: "none", border: "none", cursor: "pointer",
                     color: "#ef4444", fontSize: 14, padding: 0 }}>✕</button>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files[0] || null)} />
      {helper && <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>{helper}</p>}
    </div>
  );
}

// ─── document list with download ─────────────────────────────────────────────
function DocumentList({ transferId }) {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [dlError, setDlError] = useState("");

  useEffect(() => {
    transfersApi.getDocs(transferId)
      .then((r) => setDocs(r.data.data || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [transferId]);

  const download = async (docId, filename, mimeType) => {
    setDlError("");
    try {
      const res = await transfersApi.downloadDoc(transferId, docId);
      const blob = new Blob([res.data], { type: mimeType || "application/octet-stream" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDlError(`Download failed for "${filename}".`);
    }
  };

  if (loading) return (
    <p style={{ fontSize: 13, color: C.textSecondary, fontStyle: "italic" }}>Loading documents…</p>
  );
  if (!docs.length) return (
    <p style={{ fontSize: 13, color: C.textSecondary, fontStyle: "italic" }}>No documents uploaded yet.</p>
  );

  return (
    <div>
      {dlError && <AlertBox type="danger">{dlError}</AlertBox>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map((doc) => (
          <div key={doc.doc_id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", borderRadius: 8,
            border: "1px solid #e2e8f0", background: "#f8fafc",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>
              {DOC_ROLE_ICONS[doc.document_role] || "📄"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.navy, margin: 0 }}>
                {DOC_ROLE_LABELS[doc.document_role] || doc.document_role}
              </p>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: "2px 0 0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.original_filename} · {(doc.size_bytes / 1024).toFixed(1)} KB
              </p>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0",
                          fontFamily: "monospace", wordBreak: "break-all" }}>
                {doc.ipfs_cid}
              </p>
            </div>
            <Btn small variant="ghost"
              onClick={() => download(doc.doc_id, doc.original_filename, doc.mime_type)}>
              ⬇ Download
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── progress stepper ─────────────────────────────────────────────────────────
function Stepper({ status }) {
  const meta     = STATUS_META[status] || {};
  const current  = meta.step || 0;
  const terminal = ["APPROVED", "REJECTED", "CANCELLED", "BUYER_REJECTED"].includes(status);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-start", minWidth: 700, gap: 0 }}>
        {STEPS.map((s, i) => {
          const stepNum   = i + 1;
          const done      = terminal ? (status === "APPROVED") : stepNum < current;
          const active    = !terminal && stepNum === current;
          const dotColor  = (terminal && status !== "APPROVED" && active) ? "#ef4444"
                          : done || (terminal && status === "APPROVED") ? "#10b981"
                          : active ? C.primary : "#e2e8f0";
          const textColor = active ? C.primary : done ? "#10b981" : "#94a3b8";

          return (
            <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column",
                                      alignItems: "center", position: "relative" }}>
              {i < STEPS.length - 1 && (
                <div style={{
                  position: "absolute", top: 10, left: "50%", width: "100%", height: 2,
                  background: done || (terminal && status === "APPROVED") ? "#10b981" : "#e2e8f0",
                  zIndex: 0,
                }} />
              )}
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: dotColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 1, position: "relative", flexShrink: 0,
                boxShadow: active ? `0 0 0 3px ${C.primary}30` : undefined,
              }}>
                {(done || (terminal && status === "APPROVED")) && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5"
                          fill="none" strokeLinecap="round"/>
                  </svg>
                )}
                {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <p style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: textColor,
                          marginTop: 5, textAlign: "center", lineHeight: 1.3 }}>
                {s.short}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── event timeline ───────────────────────────────────────────────────────────
function Timeline({ events }) {
  if (!events?.length) return (
    <p style={{ fontSize: 13, color: C.textSecondary }}>No activity yet.</p>
  );
  return (
    <div>
      {events.map((e, i) => (
        <div key={e.event_id || i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 4,
              background: e.to_status === "REJECTED" || e.to_status === "BUYER_REJECTED"
                ? "#ef4444" : e.to_status === "APPROVED" ? "#10b981" : C.primary,
            }} />
            {i < events.length - 1 && (
              <div style={{ width: 1, flex: 1, background: "#e2e8f0", marginTop: 4 }} />
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "flex-start", gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.navy, margin: 0 }}>
                {(STATUS_META[e.to_status]?.label || e.to_status).replace(/_/g, " ")}
              </p>
              <span style={{ fontSize: 11, color: C.textSecondary, whiteSpace: "nowrap" }}>
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
            <p style={{ fontSize: 12, color: C.textSecondary, margin: "2px 0 0" }}>
              by {e.first_name} {e.last_name}
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 6px",
                borderRadius: 4, background: "#f1f5f9", color: "#64748b",
                textTransform: "uppercase", letterSpacing: ".04em",
              }}>{e.actor_role}</span>
            </p>
            {e.notes && (
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4,
                          background: "#f8fafc", padding: "6px 10px", borderRadius: 6,
                          borderLeft: "3px solid #e2e8f0" }}>
                {e.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Action panels
// ═══════════════════════════════════════════════════════════════════════════════

// ── Stage 1: Buyer accepts/rejects ────────────────────────────────────────────
function BuyerActionPanel({ transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [notes,   setNotes]   = useState("");

  if (transfer.status !== "PENDING_BUYER_APPROVAL") return null;

  const decide = async (decision) => {
    setError(""); setLoading(true);
    try {
      await transfersApi.buyerDecision(transfer.transfer_id, { decision, notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Action failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Your Decision Required" icon="🤝" accent="#f59e0b">
      <AlertBox type="warn">
        <strong>{transfer.seller_first_name} {transfer.seller_last_name}</strong> has requested
        a <strong>{transfer.transfer_type}</strong> transfer for{" "}
        <strong>{transfer.title_number}</strong> ({transfer.county}).
        {transfer.sale_price > 0 &&
          <> Sale price: <strong>KES {Number(transfer.sale_price).toLocaleString()}</strong>.</>}
      </AlertBox>
      <Textarea label="Notes (optional)" value={notes} onChange={setNotes}
        placeholder="Add any remarks for the record…" />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn full variant="success" onClick={() => decide("APPROVE")} loading={loading}>
          ✓ Accept Transfer
        </Btn>
        <Btn full danger onClick={() => decide("REJECT")} loading={loading}>
          ✕ Reject Transfer
        </Btn>
      </div>
    </SectionCard>
  );
}

// ── Stage 2: Surveyor uploads mutation form ───────────────────────────────────
function SurveyorActionPanel({ transfer, onSuccess }) {
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [notes,        setNotes]        = useState("");
  const [mutationFile, setMutationFile] = useState(null);
  const [coordsRaw,    setCoordsRaw]    = useState("");
  const [coordsError,  setCoordsError]  = useState("");

  if (transfer.status !== "PENDING_SURVEY") return null;

  const submit = async () => {
    if (!mutationFile) { setError("Mutation form document is required."); return; }
    if (coordsRaw.trim()) {
      try { JSON.parse(coordsRaw); }
      catch { setCoordsError("Invalid JSON — must be a valid coordinate object."); return; }
    }
    setError(""); setCoordsError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("mutation_form", mutationFile);
      if (notes) fd.append("notes", notes);
      if (coordsRaw.trim()) fd.append("coordinateAdjustments", coordsRaw);
      await transfersApi.survey(transfer.transfer_id, fd);
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Submission failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Upload Mutation Form & Survey Report" icon="📐" accent="#06b6d4">
      <AlertBox type="info">
        Prepare and upload the signed mutation form. The advocate will be notified once this is submitted
        and will proceed to upload the legal transfer agreement.
      </AlertBox>
      <FileUpload label="Mutation Form" file={mutationFile} onChange={setMutationFile}
        accept=".pdf,.jpg,.jpeg,.png"
        helper="Signed and stamped mutation form from the Survey of Kenya or county surveyor." required />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.navy,
                        marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Coordinate Adjustments{" "}
          <span style={{ fontWeight: 400, color: C.textSecondary }}>(optional JSON)</span>
        </label>
        <textarea value={coordsRaw} onChange={(e) => setCoordsRaw(e.target.value)} rows={4}
          placeholder={'{\n  "type": "Polygon",\n  "coordinates": [[[36.8, -1.3], ...]]\n}'}
          style={{
            width: "100%", padding: "9px 12px", borderRadius: 8, resize: "vertical",
            border: `1.5px solid ${coordsError ? "#ef4444" : "#e2e8f0"}`,
            fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", color: C.navy,
          }} />
        {coordsError
          ? <p style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{coordsError}</p>
          : <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>
              Leave blank if no boundary changes are needed.
            </p>}
      </div>
      <Textarea label="Survey Notes" value={notes} onChange={setNotes}
        placeholder="Describe findings, methodology, site visit date, and any adjustments…" rows={3} />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading}>Submit Mutation Form & Report</Btn>
    </SectionCard>
  );
}

// ── Stage 3: Advocate uploads legal agreement ─────────────────────────────────
function AdvocateActionPanel({ transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [files,   setFiles]   = useState({ agreement: null, consideration: null, supporting: null });
  const setFile = (k) => (f) => setFiles((p) => ({ ...p, [k]: f }));

  if (transfer.status !== "PENDING_ADVOCATE_DOCS") return null;

  const submit = async () => {
    if (!files.agreement) { setError("Agreement document is required."); return; }
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("agreement", files.agreement);
      if (files.consideration) fd.append("consideration", files.consideration);
      if (files.supporting)    fd.append("supporting",    files.supporting);
      if (notes) fd.append("notes", notes);
      await transfersApi.advocateDocs(transfer.transfer_id, fd);
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Upload failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Upload Legal Documents" icon="📋" accent="#8b5cf6">
      <AlertBox type="info">
        The surveyor has submitted the mutation form. Prepare and upload the legal transfer agreement and
        any supporting documents. All files are content-hashed for tamper-evidence.
      </AlertBox>
      <FileUpload label="Transfer / Sale Agreement" file={files.agreement}
        onChange={setFile("agreement")}
        helper="Signed agreement between buyer and seller." required />
      <FileUpload label="Proof of Consideration / Payment" file={files.consideration}
        onChange={setFile("consideration")}
        helper={transfer.transfer_type === "SALE"
          ? "Bank slip, M-Pesa statement, or payment proof." : "If applicable."} />
      <FileUpload label="Supporting Document" file={files.supporting}
        onChange={setFile("supporting")}
        helper={
          transfer.transfer_type === "INHERITANCE" ? "Death certificate or probate grant." :
          transfer.transfer_type === "COURT_ORDER"  ? "Certified court order." :
          "Any other relevant document."
        } />
      <Textarea label="Notes" value={notes} onChange={setNotes}
        placeholder="Any notes for the registry clerk…" />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading}>Upload & Forward to Registry</Btn>
    </SectionCard>
  );
}

// ── Stage 4: Clerk verifies docs ──────────────────────────────────────────────
function ClerkActionPanel({ transfer, onSuccess }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [notes,    setNotes]    = useState("");
  const [decision, setDecision] = useState("");

  if (transfer.status !== "PENDING_CLERK_VERIFICATION") return null;

  const submit = async () => {
    if (!decision) { setError("Select a decision."); return; }
    if (decision === "REJECT" && !notes.trim()) { setError("Rejection reason is required."); return; }
    setError(""); setLoading(true);
    try {
      await transfersApi.clerkVerify(transfer.transfer_id, { decision, notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Action failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Document Verification" icon="🔍" accent="#3b82f6">
      <AlertBox type="info">
        Review all uploaded documents carefully before making your verification decision.
      </AlertBox>

      {/* ── Document viewer with downloads ── */}
      <div style={{
        background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
        padding: "14px 16px", marginBottom: 18,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12,
                    textTransform: "uppercase", letterSpacing: ".04em" }}>
          📂 Submitted Documents
        </p>
        <DocumentList transferId={transfer.transfer_id} />
      </div>

      {/* ── Decision radios ── */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 8,
                    textTransform: "uppercase", letterSpacing: ".04em" }}>Your Decision</p>
        {[
          { value: "APPROVE", label: "✓ Approve — all documents valid",   color: "#059669" },
          { value: "REJECT",  label: "✕ Reject — documents insufficient", color: "#dc2626" },
        ].map((opt) => (
          <label key={opt.value} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            borderRadius: 8, marginBottom: 6, cursor: "pointer",
            border: `1.5px solid ${decision === opt.value ? opt.color : "#e2e8f0"}`,
            background: decision === opt.value ? `${opt.color}10` : "#fafafa",
          }}>
            <input type="radio" name="clerk_decision" value={opt.value}
              checked={decision === opt.value} onChange={() => setDecision(opt.value)}
              style={{ accentColor: opt.color }} />
            <span style={{ fontSize: 13, fontWeight: 500,
                           color: decision === opt.value ? opt.color : C.navy }}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
      <Textarea label={decision === "REJECT" ? "Rejection Reason *" : "Notes (optional)"}
        value={notes} onChange={setNotes} placeholder="Remarks for the audit trail…" />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading} disabled={!decision}>Submit Decision</Btn>
    </SectionCard>
  );
}

// ── Stage 5: LCB (agricultural) ──────────────────────────────────────────────
function LcbActionPanel({ transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [notes,   setNotes]   = useState("");

  if (transfer.status !== "PENDING_LCB_APPROVAL") return null;

  const decide = async (decision) => {
    setError(""); setLoading(true);
    try {
      await transfersApi.lcbDecision(transfer.transfer_id, { decision, notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Action failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Land Control Board Decision" icon="🏛️" accent="#10b981">
      <AlertBox type="warn">
        This is agricultural land. LCB consent is required before the transfer can proceed.
      </AlertBox>
      <Textarea label="Board Resolution / Notes" value={notes} onChange={setNotes}
        placeholder="Record the board's resolution, meeting reference, or remarks…" rows={4} />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn full variant="success" onClick={() => decide("APPROVE")} loading={loading}>
          ✓ Grant Consent
        </Btn>
        <Btn full danger onClick={() => decide("REJECT")} loading={loading}>
          ✕ Withhold Consent
        </Btn>
      </div>
    </SectionCard>
  );
}

// ── Stage 6: County rates ─────────────────────────────────────────────────────
function CountyActionPanel({ transfer, onSuccess }) {
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [notes,        setNotes]        = useState("");
  const [ratesCleared, setRatesCleared] = useState(null);

  if (transfer.status !== "PENDING_COUNTY_RATES") return null;

  const submit = async () => {
    if (ratesCleared === null) { setError("Please indicate whether rates are cleared."); return; }
    setError(""); setLoading(true);
    try {
      await transfersApi.countyRates(transfer.transfer_id, { ratesCleared, notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Action failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Land Rates Clearance" icon="🏢" accent="#f97316">
      <AlertBox type="info">
        Verify that all outstanding land rates for this parcel have been paid before forwarding for valuation.
      </AlertBox>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 8,
                    textTransform: "uppercase", letterSpacing: ".04em" }}>Rates Status</p>
        {[
          { value: true,  label: "✓ Rates fully cleared",               color: "#059669" },
          { value: false, label: "✕ Outstanding rates — block transfer", color: "#dc2626" },
        ].map((opt) => (
          <label key={String(opt.value)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            borderRadius: 8, marginBottom: 6, cursor: "pointer",
            border: `1.5px solid ${ratesCleared === opt.value ? opt.color : "#e2e8f0"}`,
            background: ratesCleared === opt.value ? `${opt.color}10` : "#fafafa",
          }}>
            <input type="radio" name="rates" checked={ratesCleared === opt.value}
              onChange={() => setRatesCleared(opt.value)} style={{ accentColor: opt.color }} />
            <span style={{ fontSize: 13, fontWeight: 500,
                           color: ratesCleared === opt.value ? opt.color : C.navy }}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
      <Textarea label="Notes" value={notes} onChange={setNotes}
        placeholder="Reference number, account details, or remarks…" />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading}>Submit Rates Decision</Btn>
    </SectionCard>
  );
}

// ── Stage 7: Valuer ───────────────────────────────────────────────────────────
function ValuerActionPanel({ transfer, onSuccess }) {
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [notes,        setNotes]        = useState("");
  const [valuationKES, setValuationKES] = useState("");

  const URBAN = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"];
  const rate  = URBAN.includes(transfer.county) ? 0.04 : 0.02;
  const stamp = valuationKES ? Math.round(Number(valuationKES) * rate) : null;

  if (transfer.status !== "PENDING_VALUATION") return null;

  const submit = async () => {
    if (!valuationKES) { setError("Valuation amount is required."); return; }
    setError(""); setLoading(true);
    try {
      await transfersApi.valuation(transfer.transfer_id, { valuationKES: Number(valuationKES), notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Submission failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Land Valuation" icon="📊" accent="#6366f1">
      <AlertBox type="info">
        Enter the government assessed value. Stamp duty ({rate * 100}% —{" "}
        {URBAN.includes(transfer.county) ? "urban" : "rural"} rate for {transfer.county}) will be
        calculated automatically and the buyer will be notified.
      </AlertBox>
      <Input label="Assessed Land Value (KES)" value={valuationKES} onChange={setValuationKES}
        type="number" placeholder="e.g. 5000000" required />
      {stamp !== null && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8,
                      padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "#0369a1", margin: 0 }}>
            Stamp Duty Payable ({rate * 100}%):{" "}
            <strong style={{ fontSize: 15 }}>KES {stamp.toLocaleString()}</strong>
          </p>
        </div>
      )}
      <Textarea label="Valuation Notes" value={notes} onChange={setNotes}
        placeholder="Methodology, comparable sales, site visit date…" rows={3} />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading}>Record Valuation & Notify Buyer</Btn>
    </SectionCard>
  );
}

// ── Stage 8: Buyer uploads stamp duty proof ───────────────────────────────────
function StampDutyActionPanel({ transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [file,    setFile]    = useState(null);
  const [notes,   setNotes]   = useState("");

  if (transfer.status !== "PENDING_STAMP_DUTY") return null;

  const submit = async () => {
    if (!file) { setError("Payment proof document is required."); return; }
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("paymentProof", file);
      if (notes) fd.append("notes", notes);
      await transfersApi.stampDuty(transfer.transfer_id, fd);
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Upload failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Stamp Duty Payment" icon="🧾" accent="#ec4899">
      {transfer.stamp_duty_kes && (
        <div style={{ background: "#fdf2f8", border: "1px solid #fbcfe8", borderRadius: 8,
                      padding: "12px 14px", marginBottom: 14, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9d174d", margin: 0 }}>Amount Due</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#be185d", margin: "4px 0 0" }}>
            KES {Number(transfer.stamp_duty_kes).toLocaleString()}
          </p>
        </div>
      )}
      <AlertBox type="info">Upload proof of stamp duty payment (KRA e-slip or bank receipt).</AlertBox>
      <FileUpload label="Payment Proof" file={file} onChange={setFile}
        helper="KRA e-slip, bank transfer receipt, or official payment confirmation." required />
      <Textarea label="Notes (optional)" value={notes} onChange={setNotes}
        placeholder="Payment reference number, bank, or remarks…" />
      {error && <AlertBox type="danger">{error}</AlertBox>}
      <Btn full onClick={submit} loading={loading}>Submit Payment Proof</Btn>
    </SectionCard>
  );
}

// ── Stage 9: Registrar final decision ─────────────────────────────────────────
function RegistrarActionPanel({ transfer, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [reason,  setReason]  = useState("");
  const [confirm, setConfirm] = useState(false);

  if (transfer.status !== "PENDING_REGISTRAR_APPROVAL") return null;

  const approve = async () => {
    setError(""); setLoading(true);
    try {
      await transfersApi.approve(transfer.transfer_id, { notes });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Approval failed."); }
    finally { setLoading(false); }
  };

  const reject = async () => {
    if (!reason.trim()) { setError("Rejection reason is required."); return; }
    setError(""); setLoading(true);
    try {
      await transfersApi.reject(transfer.transfer_id, { reason });
      onSuccess();
    } catch (e) { setError(e.response?.data?.message || "Rejection failed."); }
    finally { setLoading(false); }
  };

  return (
    <SectionCard title="Final Registrar Approval" icon="⚖️" accent="#0ea5e9">
      <AlertBox type="warn">
        This is the final step. Approving will transfer ownership and issue the title deed. This cannot be undone.
      </AlertBox>

      {/* Registrar sees all docs too */}
      <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
                    padding: "14px 16px", marginBottom: 18 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12,
                    textTransform: "uppercase", letterSpacing: ".04em" }}>
          📂 All Documents
        </p>
        <DocumentList transferId={transfer.transfer_id} />
      </div>

      {!confirm ? (
        <>
          <Textarea label="Approval Notes (optional)" value={notes} onChange={setNotes}
            placeholder="Any remarks for the official record…" />
          {error && <AlertBox type="danger">{error}</AlertBox>}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full variant="success" onClick={() => setConfirm(true)}>✓ Approve & Issue Title</Btn>
            <Btn full danger onClick={() => setConfirm("reject")}>✕ Reject</Btn>
          </div>
        </>
      ) : confirm === "reject" ? (
        <>
          <AlertBox type="danger">
            This will permanently reject the transfer and notify the seller.
          </AlertBox>
          <Textarea label="Rejection Reason" value={reason} onChange={setReason}
            placeholder="State the reason for rejection clearly…" required />
          {error && <AlertBox type="danger">{error}</AlertBox>}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full danger onClick={reject} loading={loading}>Confirm Rejection</Btn>
            <Btn full variant="secondary" onClick={() => setConfirm(false)}>Cancel</Btn>
          </div>
        </>
      ) : (
        <>
          <AlertBox type="warn">
            Confirm: you are about to approve transfer #{transfer.transfer_id} and issue a title to{" "}
            <strong>{transfer.buyer_first_name} {transfer.buyer_last_name}</strong>.
          </AlertBox>
          {error && <AlertBox type="danger">{error}</AlertBox>}
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full variant="success" onClick={approve} loading={loading}>✓ Confirm Approval</Btn>
            <Btn full variant="secondary" onClick={() => setConfirm(false)}>Go Back</Btn>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Stage 10: Title issued ────────────────────────────────────────────────────
function TitleCard({ transfer }) {
  if (transfer.status !== "APPROVED") return null;
  return (
    <SectionCard title="Title Deed Issued" icon="🏆" accent="#10b981">
      <div style={{
        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
        border: "1.5px solid #6ee7b7", borderRadius: 10, padding: 20, textAlign: "center",
      }}>
        <span style={{ fontSize: 40 }}>📜</span>
        <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 700,
                    color: "#065f46", marginTop: 10, marginBottom: 4 }}>
          Title Successfully Transferred
        </p>
        <p style={{ fontSize: 13, color: "#047857" }}>
          Ownership has been officially registered for{" "}
          <strong>{transfer.buyer_first_name} {transfer.buyer_last_name}</strong>
        </p>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════
export default function TransferDetail() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const { user, role } = useAuth();

  const [transfer, setTransfer] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await transfersApi.getById(id);
      setTransfer(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load transfer.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: 300, color: C.textSecondary, fontSize: 14 }}>
      Loading transfer…
    </div>
  );
  if (error) return (
    <div className="page-wrapper--narrow">
      <AlertBox type="danger">{error}</AlertBox>
      <Btn variant="secondary" onClick={() => navigate(-1)}>← Back</Btn>
    </div>
  );
  if (!transfer) return null;

  const meta    = STATUS_META[transfer.status] || {};
  const isBuyer = user?.id === transfer.new_owner_id;

  return (
    <div className="page-wrapper--narrow" style={{ paddingBottom: 40 }}>
      <Breadcrumb items={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "Transfers", to: "/transfers" },
        { label: `#${transfer.transfer_id}` },
      ]} />

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <h1 style={{ fontFamily: font.head, fontSize: 24, fontWeight: 700,
                         color: C.navy, margin: 0 }}>
              Transfer #{transfer.transfer_id}
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 13, marginTop: 4 }}>
              {transfer.title_number} · {transfer.county} · {transfer.area_hectares} ha
            </p>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 14px", borderRadius: 20,
            background: meta.bg || "#f1f5f9", color: meta.color || C.textSecondary,
            fontSize: 12, fontWeight: 700, letterSpacing: ".04em",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%",
                           background: meta.color || "#94a3b8" }} />
            {meta.label || transfer.status}
          </div>
        </div>
      </div>

      {/* ── Progress stepper ── */}
      <SectionCard>
        <Stepper status={transfer.status} />
      </SectionCard>

      {/* ── Role-specific action panels (new flow order) ── */}
      {isBuyer &&
        <BuyerActionPanel transfer={transfer} onSuccess={load} />}

      {role === "SURVEYOR" && transfer.surveyor_id === user?.id &&
        <SurveyorActionPanel transfer={transfer} onSuccess={load} />}

      {role === "ADVOCATE" && transfer.advocate_id === user?.id &&
        <AdvocateActionPanel transfer={transfer} onSuccess={load} />}

      {role === "CLERK" &&
        <ClerkActionPanel transfer={transfer} onSuccess={load} />}

      {role === "LAND_CONTROL_BOARD" &&
        <LcbActionPanel transfer={transfer} onSuccess={load} />}

      {role === "COUNTY_OFFICER" &&
        <CountyActionPanel transfer={transfer} onSuccess={load} />}

      {role === "VALUER" &&
        <ValuerActionPanel transfer={transfer} onSuccess={load} />}

      {isBuyer &&
        <StampDutyActionPanel transfer={transfer} onSuccess={load} />}

      {role === "REGISTRAR" &&
        <RegistrarActionPanel transfer={transfer} onSuccess={load} />}

      <TitleCard transfer={transfer} />

      {/* ── Detail grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Parcel" icon="🗺️">
          <Field label="Title Number" value={transfer.title_number} />
          <Field label="County"       value={transfer.county} />
          <Field label="Area"         value={`${transfer.area_hectares} ha`} />
          <Field label="Land Use"     value={transfer.land_use_type} />
        </SectionCard>

        <SectionCard title="Transfer" icon="📝">
          <Field label="Type"       value={transfer.transfer_type} />
          <Field label="Status"     value={meta.label || transfer.status} />
          <Field label="Sale Price" value={transfer.sale_price > 0
            ? `KES ${Number(transfer.sale_price).toLocaleString()}` : "N/A"} />
          <Field label="Initiated"  value={new Date(transfer.transferred_at).toLocaleDateString()} />
        </SectionCard>

        <SectionCard title="Seller" icon="👤">
          <Field label="Name"    value={`${transfer.seller_first_name} ${transfer.seller_last_name}`} />
          <Field label="User ID" value={transfer.previous_owner_id} />
        </SectionCard>

        <SectionCard title="Buyer" icon="👤">
          <Field label="Name"    value={`${transfer.buyer_first_name} ${transfer.buyer_last_name}`} />
          <Field label="User ID" value={transfer.new_owner_id} />
        </SectionCard>

        {transfer.surveyor_first_name && (
          <SectionCard title="Surveyor" icon="📐">
            <Field label="Name"    value={`${transfer.surveyor_first_name} ${transfer.surveyor_last_name}`} />
            <Field label="User ID" value={transfer.surveyor_id} />
          </SectionCard>
        )}

        {transfer.advocate_first_name && (
          <SectionCard title="Advocate" icon="⚖️">
            <Field label="Name"    value={`${transfer.advocate_first_name} ${transfer.advocate_last_name}`} />
            <Field label="User ID" value={transfer.advocate_id} />
          </SectionCard>
        )}

        {(transfer.valuation_kes || transfer.stamp_duty_kes) && (
          <SectionCard title="Financials" icon="💰">
            {transfer.valuation_kes && (
              <Field label="Land Valuation"
                value={`KES ${Number(transfer.valuation_kes).toLocaleString()}`} />
            )}
            {transfer.stamp_duty_kes && (
              <Field label="Stamp Duty"
                value={`KES ${Number(transfer.stamp_duty_kes).toLocaleString()}`} />
            )}
            <Field label="Stamp Duty Paid"
              value={transfer.stamp_duty_paid ? "✅ Yes" : "❌ Not yet"} />
          </SectionCard>
        )}
      </div>

      {/* ── IPFS hash ── */}
      {transfer.ipfs_cid && (
        <SectionCard title="Document Hash" icon="🔐">
          <Field label="Primary IPFS CID" value={transfer.ipfs_cid} mono />
          <p style={{ fontSize: 11, color: C.textSecondary, margin: 0 }}>
            SHA-256 content hash of the primary legal document. Verifiable and tamper-evident.
          </p>
        </SectionCard>
      )}

      {/* ── Activity timeline ── */}
      <SectionCard title="Activity Timeline" icon="🕐">
        <Timeline events={transfer.events} />
      </SectionCard>
    </div>
  );
}