import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { parcelsApi, encumbrancesApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import Badge   from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Breadcrumb, TabBar, Spinner, EmptyState, Alert } from "../components/ui/Feedback";
import OwnershipTimeline from "../components/ui/OwnershipTimeline";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const DEMO_PARCEL = {
  parcelID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  titleNumber: "KE/NKR/2024/0042",
  county: "Nakuru", subCounty: "Nakuru East", ward: "Biashara",
  areaHectares: 0.25, landUseType: "RESIDENTIAL", status: "ACTIVE",
  registrationDate: "2024-03-15",
  currentOwner: { nationalID: "12345678", fullName: "John Kamau" },
  activeEncumbrances: [],
  ipfsDocHash: "QmXyz123...AbCdEfG",
  blockchainTxID: "a9f3c2b1d8e7f456...",
  gpsCoordinates: { lat: -0.3031, lng: 36.0800 },
};

const DEMO_HISTORY = [
  { transferID: "TX-001", transferType: "REGISTRATION", previousOwnerID: "Government", newOwnerID: "John Kamau", transferDate: "2024-03-15", salePriceKES: 0 },
  { transferID: "TX-002", transferType: "INHERITANCE",  previousOwnerID: "Estate of Mwangi", newOwnerID: "John Kamau Sr.", transferDate: "2021-07-10", salePriceKES: 0 },
  { transferID: "TX-003", transferType: "SALE", previousOwnerID: "Nakuru County Govt", newOwnerID: "Estate of Mwangi", transferDate: "2015-02-28", salePriceKES: 1200000 },
];

const DEMO_DOCS = [
  { name: "Title Deed", docType: "TITLE_DEED", cid: "QmXyz123...AbC", date: "2024-03-15", size: "1.2 MB" },
];

const TABS = ["overview", "ownership history", "encumbrances", "documents"];

export default function ParcelDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { role, isAuthenticated } = useAuth();

  const [tab,          setTab]          = useState("overview");
  const [parcel,       setParcel]       = useState(null);
  const [history,      setHistory]      = useState([]);
  const [encumbrances, setEncumbrances] = useState([]);
  const [docs,         setDocs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, hRes, eRes, dRes] = await Promise.all([
          parcelsApi.getById(id),
          parcelsApi.getHistory(id),
          encumbrancesApi.getByParcel(id),
          parcelsApi.getDocuments(id),
        ]);
        setParcel(pRes.data?.data || null);
        setHistory(hRes.data?.data || []);
        setEncumbrances(eRes.data?.data || []);
        setDocs(dRes.data?.data || []);
      } catch (error) {
        console.error("Parcel fetch error:", error);
        
        // setHistory(DEMO_HISTORY);
        // setParcel(DEMO_PARCEL);
        // setEncumbrances([]);
        // setDocs(DEMO_DOCS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="page-wrapper"><Spinner /></div>;
  if (!parcel)  return <div className="page-wrapper"><Alert type="danger">Parcel not found.</Alert></div>;
  const activeEncumbrances = parcel.activeEncumbrances || [];
  return (
    <div className="page-wrapper">
      <Breadcrumb items={[{ label: "Search", to: "/search" }, { label: parcel.titleNumber }]} />

      {/* Page title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy }}>
              {parcel.titleNumber}
            </h1>
            <Badge status={parcel.status} />
          </div>
          <p style={{ color: C.textSecondary, fontSize: 14 }}>
            {parcel.county} County · {parcel.subCounty} · {parcel.ward}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" small onClick={() => navigate("/verify")}>Verify Document</Button>
          {isAuthenticated && ["BUYER/SELLER","LEGAL"].includes(role) && (
            <Button small onClick={() => navigate("/transfers/new")}>Initiate Transfer</Button>
          )}
          {role === "REGISTRAR" && (
            <Button variant="teal" small onClick={() => navigate(`/parcels/${id}/upload`)}>
              Upload Document
            </Button>
          )}
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid-content">
          <div>
            <Card style={{ marginBottom: 20 }}>
              <h3 className="section-title">Parcel Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {[
                  ["Title Number",      parcel.titleNumber],
                  ["County",            parcel.county],
                  ["Sub-County",        parcel.subCounty],
                  ["Ward",              parcel.ward],
                  ["Area",              `${parcel.areaHectares} hectares`],
                  ["Land Use",          parcel.landUseType],
                  ["Registration Date", parcel.createdAt ? new Date(parcel.createdAt).toLocaleDateString() : "—"],
                  ["GPS",               parcel.gpsCoordinates],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 12, color: C.textSecondary }}>{k}</p>
                    <p style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{v}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="section-title">Blockchain Record</h3>
              <div style={{ background: C.bg, borderRadius: 8, padding: 14 }}>
                {[
                  ["Transaction ID", parcel.blockchainRef],
                  ["IPFS CID",       docs.length > 0 ? docs[0].cid : "—"],
                  ["Parcel UUID",    parcel.parcelID],
                ].map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, color: C.textSecondary, marginBottom: 3 }}>{k}</p>
                    <p className="monospace" style={{ wordBreak: "break-all" }}>{v}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Card style={{ marginBottom: 16 }}>
              <h3 className="section-title">Current Owner</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: C.tealLt, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 15, fontWeight: 600, color: C.teal,
                }}>
                  {parcel.owner?.first_name && parcel.owner?.last_name
                    ? `${parcel.owner.first_name[0]}${parcel.owner.last_name[0]}`.toUpperCase()
                    : "?"}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: C.navy }}>{`${parcel.owner.first_name} ${parcel.owner.last_name}`}</p>
                  <p style={{ fontSize: 12, color: C.textSecondary }}>ID: {parcel.owner?.userID}</p>
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <h3 className="section-title">Active Encumbrances</h3>
              {activeEncumbrances?.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: C.textSecondary, fontSize: 13 }}>
                  <span style={{ fontSize: 24, display: "block", marginBottom: 6 }}>✓</span>
                  No active encumbrances
                </div>
              ) : (
                activeEncumbrances.map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span>{e.creditorName}</span>
                    <Badge status={e.encumbranceType} />
                  </div>
                ))
              )}
            </Card>

            {parcel.ipfsDocHash && (
              <Card accent>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>🔏</span>
                  <p style={{ fontWeight: 600, color: C.warn, fontSize: 14 }}>Title Deed on IPFS</p>
                </div>
                <p style={{ fontSize: 12, color: C.warn, marginBottom: 12 }}>
                  CID anchored on-chain. Document integrity is cryptographically guaranteed.
                </p>
                <Button variant="secondary" small full>View Document</Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Ownership History ─────────────────────────────────────── */}
      {tab === "ownership history" && (
        <Card>
          <h3 className="section-title">Chain of Title</h3>
          <OwnershipTimeline records={history} />
        </Card>
      )}

      {/* ── Encumbrances ─────────────────────────────────────────── */}
      {tab === "encumbrances" && (
        <Card>
          <h3 className="section-title">Encumbrances</h3>
          {encumbrances.length === 0 ? (
            <EmptyState icon="🔓" title="No Encumbrances" message="This parcel has no active or historical financial claims." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {["Type","Creditor","Amount (KES)","Registered","Status"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {encumbrances.map((e) => (
                  <tr key={e.encumbranceID}>
                    <td><Badge status={e.encumbranceType} /></td>
                    <td>{e.creditorName}</td>
                    <td>{e.amountKES > 0 ? e.amountKES.toLocaleString() : "—"}</td>
                    <td style={{ color: C.textSecondary }}>{e.registrationDate}</td>
                    <td><Badge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── Documents ────────────────────────────────────────────── */}
      {tab === "documents" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Attached Documents</h3>
            {role === "REGISTRAR" && (
              <Button small onClick={() => navigate(`/parcels/${id}/upload`)}>+ Upload Document</Button>
            )}
          </div>
          {docs.length === 0 ? (
            <EmptyState icon="📂" title="No documents" message="No documents have been attached to this parcel yet." />
          ) : (
            docs.map((d, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "14px 0",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 36, height: 36, background: "#FEE2E2",
                    borderRadius: 8, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 16,
                  }}>📄</div>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14 }}>{d.name}</p>
                    <p style={{ fontSize: 12, color: C.textSecondary }}>{d.docType} · {d.date}</p>
                    <p className="monospace">{d.cid}</p>
                  </div>
                </div>
                <Button variant="secondary" small>Download</Button>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
