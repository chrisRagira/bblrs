import { useNavigate } from "react-router-dom";
import { parcelsApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert, Breadcrumb, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { C, font } from "../styles/tokens";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const STEPS = ["Select Parcel", "Define Sub-parcels", "Review & Submit"];

const LAND_USE_TYPES = [
  { value: "",              label: "— Select land use —" },
  { value: "RESIDENTIAL",  label: "Residential" },
  { value: "AGRICULTURAL", label: "Agricultural" },
  { value: "COMMERCIAL",   label: "Commercial" },
  { value: "INDUSTRIAL",   label: "Industrial" },
  { value: "RECREATIONAL", label: "Recreational" },
  { value: "INSTITUTIONAL",label: "Institutional" },
  { value: "MIXED_USE",    label: "Mixed Use" },
  { value: "CONSERVATION", label: "Conservation" },
];

export default function SubDivisionForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allParcels,  setAllParcels]  = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError,   setListError]   = useState("");
  const [search,      setSearch]      = useState("");

  const [parcel,   setParcel]   = useState(null);   // selected parent parcel
  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [resultId, setResultId] = useState("");

  const [subParcels, setSubParcels] = useState([
    { titleNumber: "", areaHectares: "", landUseType: "" },
    { titleNumber: "", areaHectares: "", landUseType: "" },
  ]);

  // Fetch ALL parcels on mount (registrar sees everything)
  useEffect(() => {
    setListLoading(true);
    parcelsApi.getByOwner(user.id)
      .then((res) => setAllParcels(res.data.data || []))
      .catch(() => setListError("Could not load parcels. Please try again."))
      .finally(() => setListLoading(false));
  }, []);

  const filtered = allParcels.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.titleNumber?.toLowerCase().includes(q) ||
      p.county?.toLowerCase().includes(q) ||
      p.landUseType?.toLowerCase().includes(q)
    );
  });

  const selectParcel = (p) => {
    setParcel(p);
    setSubParcels([
      { titleNumber: "", areaHectares: "", landUseType: "" },
      { titleNumber: "", areaHectares: "", landUseType: "" },
    ]);
  };

  /* ── sub-parcel helpers ── */
  const totalAllocated = subParcels.reduce(
    (sum, sp) => sum + (parseFloat(sp.areaHectares) || 0), 0
  );
  const parentArea   = parseFloat(parcel?.areaHectares) || 0;
  const areaBalanced = Math.abs(totalAllocated - parentArea) < 0.0001;

  const setSubParcel = (index, field) => (e) =>
    setSubParcels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: e.target.value };
      return next;
    });

  const addSubParcel = () =>
    setSubParcels((prev) => [...prev, { titleNumber: "", areaHectares: "", landUseType: "" }]);

  const removeSubParcel = (index) => {
    if (subParcels.length <= 2) return;
    setSubParcels((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── validation ── */
  const step1Valid = !!parcel;
  const step2Valid =
    subParcels.every((sp) => sp.titleNumber && sp.areaHectares && sp.landUseType) &&
    areaBalanced;

  /* ── submit ── */
  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await parcelsApi.subdivide(parcel.parcelID, {
        subParcels: subParcels.map((sp) => ({
          titleNumber:  sp.titleNumber,
          areaHectares: parseFloat(sp.areaHectares),
          landUseType:  sp.landUseType,
        })),
      });
      setResultId(res.data.data?.subdivisionID || res.data.data?.id || parcel.parcelID);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit subdivision request.");
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
      <Breadcrumb items={[
        { label: "Dashboard",   to: "/dashboard" },
        { label: "Parcels",     to: "/parcels" },
        { label: "Subdivision" },
      ]} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy, marginBottom: 4 }}>
          Parcel Subdivision
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14 }}>
          Split an existing parcel into two or more new sub-parcels. The total area of all
          sub-parcels must equal the parent parcel's area.
        </p>
      </div>

      {step < 4 && <StepBar steps={STEPS} current={step} />}

      <Card>
        {error && <Alert type="danger">{error}</Alert>}

        {/* ══════════════════════════════════════════
            Step 1 — Select Parcel
        ══════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <Alert type="info">
              Search and select the parcel you want to subdivide.
            </Alert>

            {/* Search bar */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{
                position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                color: C.textSecondary, fontSize: 15, pointerEvents: "none",
              }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Search by title number, county or land use…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px 9px 36px",
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                  background: C.bg,
                }}
              />
            </div>

            {listLoading && (
              <p style={{ color: C.textSecondary, fontSize: 13, marginBottom: 16 }}>
                Loading parcels…
              </p>
            )}
            {listError && <Alert type="danger">{listError}</Alert>}

            {!listLoading && !listError && filtered.length === 0 && (
              <p style={{ color: C.textSecondary, fontSize: 13, marginBottom: 16 }}>
                No parcels found{search ? " matching your search" : ""}.
              </p>
            )}

            {/* Scrollable parcel list */}
            <div style={{ marginBottom: 16, maxHeight: 400, overflowY: "auto" }}>
              {filtered.map((p) => {
                const selected = parcel?.parcelID === p.parcelID;
                return (
                  <div
                    key={p.parcelID}
                    onClick={() => selectParcel(p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 14px", marginBottom: 8,
                      border: `2px solid ${selected ? C.navy : C.border}`,
                      borderRadius: 8, cursor: "pointer",
                      background: selected ? "#f0f4ff" : C.bg,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    {/* Radio-style dot */}
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${selected ? C.navy : C.border}`,
                      background: selected ? C.navy : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected && (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 3,
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
                  </div>
                );
              })}
            </div>

            {/* Selected parcel detail summary */}
            {parcel && (
              <div style={{
                background: C.bg, borderRadius: 8, padding: 14, marginBottom: 16,
                border: `1px solid ${C.border}`,
              }}>
                <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>
                  Selected Parcel
                </p>
                {[
                  ["Title Number", parcel.titleNumber],
                  ["County",       parcel.county],
                  ["Area",         `${parcel.areaHectares} ha`],
                  ["Land Use",     parcel.landUseType],
                  ["Status",       null],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                  }}>
                    <span style={{ color: C.textSecondary }}>{k}</span>
                    {k === "Status"
                      ? <Badge status={parcel.status} />
                      : <span style={{ fontWeight: 500 }}>{v}</span>}
                  </div>
                ))}
              </div>
            )}

            {parcel?.status === "ENCUMBERED" && (
              <Alert type="warn">
                This parcel has active encumbrances. Subdivision may require encumbrance
                resolution first.
              </Alert>
            )}

            <Button full onClick={() => setStep(2)} disabled={!step1Valid}>
              Continue
            </Button>
          </>
        )}

        {/* ══════════════════════════════════════════
            Step 2 — Define Sub-parcels
        ══════════════════════════════════════════ */}
        {step === 2 && (
          <>
            <Alert type="info">
              Define each sub-parcel. Areas must sum to exactly{" "}
              <strong>{parcel?.areaHectares} ha</strong>.
            </Alert>

            {/* Area balance tracker */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: areaBalanced ? "#f0fdf4" : "#fff7ed",
              border: `1px solid ${areaBalanced ? "#86efac" : "#fdba74"}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13,
            }}>
              <span style={{ color: C.textSecondary }}>
                Allocated: <strong>{totalAllocated.toFixed(4)} ha</strong>
              </span>
              <span style={{ color: C.textSecondary }}>
                Parent: <strong>{parentArea} ha</strong>
              </span>
              <span style={{ fontWeight: 600, color: areaBalanced ? "#16a34a" : "#ea580c" }}>
                {areaBalanced
                  ? "✓ Balanced"
                  : `${Math.abs(totalAllocated - parentArea).toFixed(4)} ha ${totalAllocated > parentArea ? "over" : "remaining"}`}
              </span>
            </div>

            {subParcels.map((sp, i) => (
              <div key={i} style={{
                background: C.bg, borderRadius: 8, padding: 14, marginBottom: 12,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 10,
                }}>
                  <p style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>
                    Sub-parcel {i + 1}
                  </p>
                  {subParcels.length > 2 && (
                    <button
                      onClick={() => removeSubParcel(i)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#ef4444", fontSize: 12, padding: "2px 6px",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {/* <FormField
                  label="New Title Number"
                  name={`titleNumber-${i}`}
                  placeholder="e.g. KSM/TOWN/1234/A"
                  value={sp.titleNumber}
                  onChange={setSubParcel(i, "titleNumber")}
                  required
                /> */}
                <FormField
                  label="Area (ha)"
                  name={`areaHectares-${i}`}
                  type="number"
                  placeholder="e.g. 0.5"
                  value={sp.areaHectares}
                  onChange={setSubParcel(i, "areaHectares")}
                  required
                />
                <SelectField
                  label="Land Use Type"
                  name={`landUseType-${i}`}
                  value={sp.landUseType}
                  onChange={setSubParcel(i, "landUseType")}
                  options={LAND_USE_TYPES}
                  required
                />
              </div>
            ))}

            <button
              onClick={addSubParcel}
              style={{
                display: "block", width: "100%", padding: "10px",
                border: `2px dashed ${C.border}`, borderRadius: 8,
                background: "transparent", cursor: "pointer",
                color: C.textSecondary, fontSize: 13, marginBottom: 16,
              }}
            >
              + Add Sub-parcel
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button full onClick={() => setStep(3)} disabled={!step2Valid}>
                Review Subdivision
              </Button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            Step 3 — Review
        ══════════════════════════════════════════ */}
        {step === 3 && (
          <>
            <Alert type="warn">
              Review all details carefully. This will deactivate the parent parcel and create
              new sub-parcels.
            </Alert>

            <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>
                Parent Parcel
              </p>
              <ReviewRow label="Title Number" value={parcel?.titleNumber} />
              <ReviewRow label="County"       value={parcel?.county} />
              <ReviewRow label="Total Area"   value={`${parcel?.areaHectares} ha`} />
              <ReviewRow label="Status"       value={parcel?.status} badge />
            </div>

            {subParcels.map((sp, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <p style={{ fontWeight: 500, fontSize: 13, color: C.navy, marginBottom: 10 }}>
                  Sub-parcel {i + 1}
                </p>
                <ReviewRow label="Title Number" value={sp.titleNumber} />
                <ReviewRow label="Area"         value={`${sp.areaHectares} ha`} />
                <ReviewRow label="Land Use"     value={sp.landUseType} />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button full onClick={handleSubmit} disabled={loading}>
                {loading ? "Submitting…" : "Submit Subdivision"}
              </Button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            Step 4 — Success
        ══════════════════════════════════════════ */}
        {step === 4 && (
          <>
            <Alert type="success">
              Subdivision submitted successfully. New sub-parcels have been created.
            </Alert>
            <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>✅</span>
              <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
                Subdivision Complete
              </p>
              {resultId && (
                <p className="monospace" style={{ marginBottom: 16 }}>#{resultId}</p>
              )}
              <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 24 }}>
                The parent parcel has been deactivated and {subParcels.length} new sub-parcels
                have been registered.
              </p>
            </div>
            <Button full onClick={() => navigate("/parcels")}>Back to Parcels</Button>
          </>
        )}
      </Card>
    </div>
  );
}