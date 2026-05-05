import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { transfersApi, parcelsApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert, Breadcrumb, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { C, font } from "../styles/tokens";
import { useState, useEffect } from "react";

const STEPS = ["Parcel Selection", "Buyer & Transfer", "Advocate", "Review & Submit"];

const TRANSFER_TYPES = [
  { value: "SALE",        label: "Sale" },
  { value: "GIFT",        label: "Gift" },
  { value: "INHERITANCE", label: "Inheritance" },
  { value: "COURT_ORDER", label: "Court Order" },
];

export default function TransferForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ownedParcels, setOwnedParcels]   = useState([]);
  const [step,         setStep]           = useState(1);
  const [loading,      setLoading]        = useState(false);
  const [error,        setError]          = useState("");
  const [transferId,   setTransferId]     = useState("");

  const [form, setForm] = useState({
    parcelID:            "",
    buyerNationalId:     "",
    buyerFullName:       "",
    transferType:        "SALE",
    salePriceKES:        "",
    advocateNationalId:  "",
    advocateFullName:    "",
  });

  useEffect(() => {
    if (!user?.id) return;
    parcelsApi.getByOwner(user.id)
      .then((res) => setOwnedParcels(res.data.data || []))
      .catch(() => setOwnedParcels([]));
  }, [user]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedParcel = ownedParcels.find((p) => String(p.parcelID) === String(form.parcelID));

  const step1Valid = !!form.parcelID;
  const step2Valid = form.buyerNationalId && form.buyerFullName &&
                     (form.transferType !== "SALE" || form.salePriceKES);
  const step3Valid = form.advocateNationalId && form.advocateFullName;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await transfersApi.initiate({
        parcelID:           form.parcelID,
        newOwnerID:         form.buyerNationalId,
        transferType:       form.transferType,
        salePriceKES:       form.transferType === "SALE" ? Number(form.salePriceKES) : 0,
        advocateNationalId: form.advocateNationalId,
      });
      setTransferId(res.data.data.transferID);
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit transfer request.");
    } finally {
      setLoading(false);
    }
  };

  /* ── shared review row ── */
  const ReviewRow = ({ label, value, badge }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
    }}>
      <span style={{ color: C.textSecondary }}>{label}</span>
      {badge ? <Badge status={value} /> : <span style={{ fontWeight: 500 }}>{value}</span>}
    </div>
  );

  return (
    <div className="page-wrapper--narrow">
      <Breadcrumb items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Initiate Transfer" }]} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Initiate Ownership Transfer
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14 }}>
          Request a transfer of land parcel ownership. Your advocate will prepare and upload all legal documents.
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
                  ["County",   selectedParcel.county],
                  ["Area",     `${selectedParcel.areaHectares} ha`],
                  ["Use Type", selectedParcel.landUseType],
                  ["Status",   null],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
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

        {/* ── Step 2: Buyer & Transfer details ── */}
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

        {/* ── Step 3: Advocate ── */}
        {step === 3 && (
          <>
            <Alert type="info">
              Appoint a registered advocate. They will be notified and will prepare and upload all legal documents on your behalf.
            </Alert>

            <FormField
              label="Advocate's National ID" name="advocateNationalId"
              placeholder="98765432"
              value={form.advocateNationalId} onChange={set("advocateNationalId")}
              helper="The advocate must be a registered advocate in the BBLRS system."
              required
            />
            <FormField
              label="Advocate's Full Name" name="advocateFullName"
              placeholder="John Kamau"
              value={form.advocateFullName} onChange={set("advocateFullName")}
              required
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
              Review all details carefully. Once submitted, the buyer will be notified to approve and your advocate will be appointed.
            </Alert>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Parcel</p>
              <ReviewRow label="Title Number" value={selectedParcel?.titleNumber} />
              <ReviewRow label="County"       value={selectedParcel?.county} />
              <ReviewRow label="Area"         value={`${selectedParcel?.areaHectares} ha`} />
              <ReviewRow label="Status"       value={selectedParcel?.status} badge />
            </div>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Transfer Details</p>
              <ReviewRow label="Transfer Type" value={form.transferType} />
              <ReviewRow label="Buyer Name"    value={form.buyerFullName} />
              <ReviewRow label="Buyer ID"      value={form.buyerNationalId} />
              {form.transferType === "SALE" && (
                <ReviewRow label="Sale Price" value={`KES ${Number(form.salePriceKES).toLocaleString()}`} />
              )}
            </div>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>Appointed Advocate</p>
              <ReviewRow label="Full Name"   value={form.advocateFullName} />
              <ReviewRow label="National ID" value={form.advocateNationalId} />
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
              Transfer request submitted. The buyer and your advocate have been notified.
            </Alert>
            <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>✅</span>
              <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
                Request Created
              </p>
              {transferId && (
                <p className="monospace" style={{ marginBottom: 16 }}>#{transferId}</p>
              )}
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 8 }}>
                <strong>Next step:</strong> The buyer must approve this request before it proceeds.
              </p>
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
                Your advocate will then be notified to prepare the legal documents.
              </p>
            </div>
            <Button full onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </>
        )}
      </Card>
    </div>
  );
}