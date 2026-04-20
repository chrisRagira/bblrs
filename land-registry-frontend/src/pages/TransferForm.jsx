import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { transfersApi, parcelsApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert, Breadcrumb, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { C, font } from "../styles/tokens";
import { useState, useEffect, useRef } from "react";

const STEPS = ["Parcel Selection", "Buyer Details", "Documents", "Review & Submit"];

const TRANSFER_TYPES = [
  { value: "SALE",        label: "Sale" },
  { value: "GIFT",        label: "Gift" },
  { value: "INHERITANCE", label: "Inheritance" },
  { value: "COURT_ORDER", label: "Court Order" },
];

function FileUploadField({ label, name, accept, file, onChange, required, helper }) {
  const inputRef = useRef();
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.navy, marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#e53e3e" }}>*</span>}
      </label>
      <div
        onClick={() => inputRef.current.click()}
        style={{
          border: `2px dashed ${file ? C.primary : C.border}`,
          borderRadius: 8,
          padding: "14px 16px",
          cursor: "pointer",
          background: file ? `${C.primary}08` : C.bg,
          display: "flex",
          alignItems: "center",
          gap: 10,
          transition: "all 0.2s",
        }}
      >
        <span style={{ fontSize: 20 }}>{file ? "📄" : "📁"}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: file ? C.primary : C.textSecondary, margin: 0 }}>
            {file ? file.name : "Click to upload"}
          </p>
          {file && (
            <p style={{ fontSize: 11, color: C.textSecondary, margin: 0 }}>
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        {file && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#e53e3e", fontSize: 16 }}
          >✕</button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
      {helper && <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{helper}</p>}
    </div>
  );
}

export default function TransferForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ownedParcels, setOwnedParcels] = useState([]);
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [txId,    setTxId]    = useState("");

  const [form, setForm] = useState({
    parcelID:        "",
    buyerNationalId: "",
    buyerFullName:   "",
    transferType:    "SALE",
    salePriceKES:    "",
  });

  const [docs, setDocs] = useState({
    contract:      null, // sale/transfer agreement
    consideration: null, // proof of payment / consideration
    supporting:    null, // court order, death cert, etc.
  });

  useEffect(() => {
    const loadParcels = async () => {
      if (!user?.id) return;
      try {
        const res = await parcelsApi.getByOwner(user.id);
        setOwnedParcels(res.data.data || []);
      } catch (err) {
        console.error("Failed to load parcels:", err);
        setOwnedParcels([]);
      }
    };
    loadParcels();
  }, [user]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setDoc = (key) => (file) => setDocs((d) => ({ ...d, [key]: file }));

  const selectedParcel = ownedParcels.find((p) => p.parcelID === form.parcelID);
  const step1Valid  = !!form.parcelID;
  const step2Valid  = form.buyerNationalId && form.buyerFullName;
  const step3Valid  = !!docs.contract && (form.transferType !== "SALE" || !!docs.consideration);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("parcelID",     form.parcelID);
      formData.append("newOwnerID",   form.buyerNationalId);
      formData.append("transferType", form.transferType);
      formData.append("salePriceKES", form.transferType === "SALE" ? Number(form.salePriceKES) : 0);
      if (docs.contract)      formData.append("contract",      docs.contract);
      if (docs.consideration) formData.append("consideration", docs.consideration);
      if (docs.supporting)    formData.append("supporting",    docs.supporting);

      const res = await transfersApi.initiate(formData);
      setTxId(res.data.data.transferID);
      setStep(5); // success
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit transfer request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper--narrow">
      <Breadcrumb items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Initiate Transfer" }]} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Initiate Ownership Transfer
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14 }}>
          Request a transfer of land parcel ownership to a new owner.
        </p>
      </div>

      {step < 5 && <StepBar steps={STEPS} current={step} />}

      <Card>
        {error && <Alert type="danger">{error}</Alert>}

        {/* ── Step 1: Parcel ── */}
        {step === 1 && (
          <>
            <Alert type="info">
              Select the parcel you wish to transfer. Encumbered parcels can be transferred — encumbrances will carry over to the new owner.
            </Alert>

            <SelectField
              label="Select Parcel" name="parcelID"
              value={form.parcelID} onChange={set("parcelID")}
              options={[
                { value: "", label: "— Choose a parcel —" },
                ...ownedParcels.map((p) => ({
                  value: p.parcelID,
                  label: `${p.titleNumber} — ${p.county}, ${p.areaHectares} ha (${p.status})`,
                })),
              ]}
              required
            />

            {selectedParcel?.status === "ENCUMBERED" && (
              <Alert type="warn">
                This parcel has active encumbrances. They will be transferred to the new owner upon approval.
              </Alert>
            )}

            {selectedParcel && (
              <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Parcel Summary</p>
                {[
                  ["County",       selectedParcel.county],
                  ["Area",         `${selectedParcel.areaHectares} ha`],
                  ["Use Type",     selectedParcel.landUseType],
                  ["Status",       null],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                  }}>
                    <span style={{ color: C.textSecondary }}>{k}</span>
                    {k === "Status"
                      ? <Badge status={selectedParcel.status} />
                      : <span style={{ fontWeight: 500 }}>{v}</span>}
                  </div>
                ))}
              </div>
            )}

            <Button full onClick={() => setStep(2)} disabled={!step1Valid}>Continue</Button>
          </>
        )}

        {/* ── Step 2: Buyer details ── */}
        {step === 2 && (
          <>
            <FormField
              label="Buyer's National ID" name="buyerNationalId"
              placeholder="12345678"
              value={form.buyerNationalId} onChange={set("buyerNationalId")}
              helper="The buyer must be a registered user in the BBLRS system."
              required
            />
            <FormField
              label="Buyer's Full Name" name="buyerFullName"
              placeholder="Jane Wanjiku"
              value={form.buyerFullName} onChange={set("buyerFullName")}
              required
            />
            <SelectField
              label="Transfer Type" name="transferType"
              value={form.transferType} onChange={set("transferType")}
              options={TRANSFER_TYPES} required
            />
            {form.transferType === "SALE" && (
              <FormField
                label="Sale Price (KES)" name="salePriceKES" type="number"
                placeholder="e.g. 2500000"
                value={form.salePriceKES} onChange={set("salePriceKES")}
                required
              />
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button full onClick={() => setStep(3)} disabled={!step2Valid}>Continue</Button>
            </div>
          </>
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <>
            <Alert type="info">
              Upload the required supporting documents. Accepted formats: PDF, JPG, PNG.
            </Alert>

            <FileUploadField
              label="Transfer / Sale Agreement"
              name="contract"
              accept=".pdf,.jpg,.jpeg,.png"
              file={docs.contract}
              onChange={setDoc("contract")}
              helper="Signed agreement between seller and buyer."
              required
            />

            {form.transferType === "SALE" && (
              <FileUploadField
                label="Proof of Consideration / Payment"
                name="consideration"
                accept=".pdf,.jpg,.jpeg,.png"
                file={docs.consideration}
                onChange={setDoc("consideration")}
                helper="Bank slip, M-Pesa statement, or other payment proof."
                required
              />
            )}

            <FileUploadField
              label="Supporting Document (Optional)"
              name="supporting"
              accept=".pdf,.jpg,.jpeg,.png"
              file={docs.supporting}
              onChange={setDoc("supporting")}
              helper={
                form.transferType === "INHERITANCE" ? "Death certificate or grant of probate." :
                form.transferType === "COURT_ORDER" ? "Certified court order." :
                "Any other relevant document."
              }
            />

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button full onClick={() => setStep(4)} disabled={!step3Valid}>Review Transfer</Button>
            </div>
          </>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && (
          <>
            <Alert type="warn">
              Review all details carefully. Once submitted, this request will be sent to the Registrar for approval.
            </Alert>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Transfer Details</p>
              {[
                ["Parcel",        selectedParcel?.titleNumber],
                ["Transfer Type", form.transferType],
                ["Buyer Name",    form.buyerFullName],
                ["Buyer ID",      form.buyerNationalId],
                ...(form.transferType === "SALE"
                  ? [["Sale Price", `KES ${Number(form.salePriceKES).toLocaleString()}`]]
                  : []),
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                }}>
                  <span style={{ color: C.textSecondary }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Attached Documents</p>
              {[
                ["Contract",      docs.contract],
                ["Consideration", docs.consideration],
                ["Supporting",    docs.supporting],
              ].filter(([, f]) => f).map(([k, f]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                }}>
                  <span style={{ color: C.textSecondary }}>{k}</span>
                  <span style={{ fontWeight: 500, color: C.primary }}>📄 {f.name}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button full onClick={handleSubmit} disabled={loading}>
                {loading ? "Submitting…" : "Submit Transfer Request"}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 5: Success ── */}
        {step === 5 && (
          <>
            <Alert type="success">
              Transfer request submitted successfully! The Registrar has been notified.
            </Alert>
            <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>✅</span>
              <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
                Request Created
              </p>
              {txId && (
                <p className="monospace" style={{ marginBottom: 16 }}>{txId}</p>
              )}
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
                You will be notified when the Registrar approves or rejects the transfer.
              </p>
            </div>
            <Button full onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </>
        )}
      </Card>
    </div>
  );
}