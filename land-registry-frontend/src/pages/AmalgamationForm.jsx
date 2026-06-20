import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { parcelsApi } from "../api/services";
import { FormField } from "../components/ui/FormField";
import { Alert, Breadcrumb, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { C, font } from "../styles/tokens";
import { useState, useEffect } from "react";

const STEPS = ["Select Parcels", "New Parcel Details", "Review & Submit"];

export default function AmalgamationForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ownedParcels,   setOwnedParcels]   = useState([]);
  const [selectedIds,    setSelectedIds]     = useState([]);
  const [step,           setStep]            = useState(1);
  const [loading,        setLoading]         = useState(false);
  const [error,          setError]           = useState("");
  const [resultId,       setResultId]        = useState("");

  const [newParcel, setNewParcel] = useState({
    titleNumber:  "",
    landUseType:  "",
  });

  useEffect(() => {
    if (!user?.id) return;
    parcelsApi.getByOwner(user.id)
      .then((res) => setOwnedParcels(res.data.data || []))
      .catch(() => setOwnedParcels([]));
  }, [user]);

  const setField = (field) => (e) =>
    setNewParcel((f) => ({ ...f, [field]: e.target.value }));

  const toggleParcel = (parcelID) => {
    setSelectedIds((prev) =>
      prev.includes(parcelID)
        ? prev.filter((id) => id !== parcelID)
        : [...prev, parcelID]
    );
  };

  const selectedParcels = ownedParcels.filter((p) =>
    selectedIds.includes(String(p.parcelID))
  );

  const totalArea = selectedParcels.reduce(
    (sum, p) => sum + (parseFloat(p.areaHectares) || 0), 0
  );

  const hasEncumbered = selectedParcels.some((p) => p.status === "ENCUMBERED");

  const step1Valid = selectedIds.length >= 2;
  const step2Valid = newParcel.titleNumber && newParcel.landUseType;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await parcelsApi.amalgamate({
        parcelIDs:    selectedIds,
        titleNumber:  newParcel.titleNumber,
        landUseType:  newParcel.landUseType,
      });
      setResultId(res.data.data?.amalgamationID || res.data.data?.id || "");
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit amalgamation request.");
    } finally {
      setLoading(false);
    }
  };

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
      <Breadcrumb items={[
        { label: "Dashboard", to: "/dashboard" },
        { label: "Parcels",   to: "/parcels" },
        { label: "Amalgamation" },
      ]} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Parcel Amalgamation
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14 }}>
          Merge two or more parcels into a single new parcel. All selected parcels must be owned by you and be in the same county.
        </p>
      </div>

      {step < 4 && <StepBar steps={STEPS} current={step} />}

      <Card>
        {error && <Alert type="danger">{error}</Alert>}

        {/* ── Step 1: Select Parcels ── */}
        {step === 1 && (
          <>
            <Alert type="info">
              Select at least two parcels to amalgamate. They must share the same county.
            </Alert>

            {ownedParcels.length === 0 ? (
              <p style={{ color: C.textSecondary, fontSize: 13, marginBottom: 16 }}>
                No parcels found under your account.
              </p>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {ownedParcels.map((p) => {
                  const checked = selectedIds.includes(String(p.parcelID));
                  return (
                    <label
                      key={p.parcelID}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 14px", marginBottom: 8,
                        border: `2px solid ${checked ? C.navy : C.border}`,
                        borderRadius: 8, cursor: "pointer",
                        background: checked ? "#f0f4ff" : C.bg,
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParcel(String(p.parcelID))}
                        style={{ marginTop: 2, accentColor: C.navy, width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 4,
                        }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>
                            {p.titleNumber}
                          </span>
                          <Badge status={p.status} />
                        </div>
                        <span style={{ fontSize: 12, color: C.textSecondary }}>
                          {p.county} · {p.areaHectares} ha · {p.landUseType}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Selection summary */}
            {selectedIds.length > 0 && (
              <div style={{
                background: C.bg, borderRadius: 8, padding: "10px 14px",
                marginBottom: 16, fontSize: 13,
                border: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between",
              }}>
                <span style={{ color: C.textSecondary }}>
                  <strong>{selectedIds.length}</strong> parcel{selectedIds.length > 1 ? "s" : ""} selected
                </span>
                <span style={{ color: C.textSecondary }}>
                  Combined area: <strong>{totalArea.toFixed(4)} ha</strong>
                </span>
              </div>
            )}

            {hasEncumbered && (
              <Alert type="warn">
                One or more selected parcels have active encumbrances. These must be resolved before amalgamation.
              </Alert>
            )}

            <Button full onClick={() => setStep(2)} disabled={!step1Valid || hasEncumbered}>
              Continue
            </Button>
          </>
        )}

        {/* ── Step 2: New Parcel Details ── */}
        {step === 2 && (
          <>
            <Alert type="info">
              Provide the details for the new amalgamated parcel. The combined area will be <strong>{totalArea.toFixed(4)} ha</strong>.
            </Alert>

            <FormField
              label="New Title Number"
              name="titleNumber"
              placeholder="e.g. KSM/TOWN/5678"
              value={newParcel.titleNumber}
              onChange={setField("titleNumber")}
              helper="Assign a new title number for the amalgamated parcel."
              required
            />
            <FormField
              label="Land Use Type"
              name="landUseType"
              placeholder="e.g. RESIDENTIAL, AGRICULTURAL, COMMERCIAL"
              value={newParcel.landUseType}
              onChange={setField("landUseType")}
              required
            />

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button full onClick={() => setStep(3)} disabled={!step2Valid}>
                Review Amalgamation
              </Button>
            </div>
          </>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <>
            <Alert type="warn">
              Review carefully. All selected parcels will be deactivated and replaced by the new amalgamated parcel.
            </Alert>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>
                Parcels to be Merged ({selectedParcels.length})
              </p>
              {selectedParcels.map((p, i) => (
                <div key={p.parcelID}>
                  <ReviewRow label={`#${i + 1} Title`}  value={p.titleNumber} />
                  <ReviewRow label="County"              value={p.county} />
                  <ReviewRow label="Area"                value={`${p.areaHectares} ha`} />
                  <ReviewRow label="Status"              value={p.status} badge />
                  {i < selectedParcels.length - 1 && (
                    <div style={{ height: 8 }} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>
                New Amalgamated Parcel
              </p>
              <ReviewRow label="New Title Number" value={newParcel.titleNumber} />
              <ReviewRow label="Combined Area"    value={`${totalArea.toFixed(4)} ha`} />
              <ReviewRow label="Land Use Type"    value={newParcel.landUseType} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button full onClick={handleSubmit} disabled={loading}>
                {loading ? "Submitting…" : "Submit Amalgamation"}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 4: Success ── */}
        {step === 4 && (
          <>
            <Alert type="success">
              Amalgamation submitted successfully. The new parcel has been registered.
            </Alert>
            <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>✅</span>
              <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
                Amalgamation Complete
              </p>
              {resultId && (
                <p className="monospace" style={{ marginBottom: 16 }}>#{resultId}</p>
              )}
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 8 }}>
                <strong>{selectedParcels.length}</strong> parcels have been merged into{" "}
                <strong>{newParcel.titleNumber}</strong>.
              </p>
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
                The original parcels have been deactivated in the registry.
              </p>
            </div>
            <Button full onClick={() => navigate("/parcels")}>Back to Parcels</Button>
          </>
        )}
      </Card>
    </div>
  );
}