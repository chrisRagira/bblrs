// ─── EncumbranceManager.jsx ──────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { encumbrancesApi } from "../api/services";
import { PageHeader, StatCard, Card } from "../components/ui/Card";
import { Alert, Spinner, EmptyState } from "../components/ui/Feedback";
import { FormField, SelectField } from "../components/ui/FormField";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const DEMO_ENCUMBRANCES = [
  { encumbranceID:"EN-001", parcelID:"KE/NAI/2023/0180", encumbranceType:"MORTGAGE", creditorName:"KCB Bank Kenya",    amountKES:4500000, registrationDate:"2023-11-01", status:"ACTIVE"     },
  { encumbranceID:"EN-002", parcelID:"KE/KSM/2020/0055", encumbranceType:"LIEN",     creditorName:"Equity Bank",        amountKES:800000,  registrationDate:"2022-05-14", status:"ACTIVE"     },
  { encumbranceID:"EN-003", parcelID:"KE/NAK/2019/0212", encumbranceType:"CAVEAT",   creditorName:"Estate of Njoroge",  amountKES:0,       registrationDate:"2019-09-20", status:"DISCHARGED" },
];

export function EncumbranceManager() {
  const [mode,  setMode]  = useState("list"); // "list" | "register"
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form,  setForm]  = useState({
    parcelID:"", encumbranceType:"MORTGAGE", creditorName:"",
    creditorID:"", amountKES:"", registrationDate:"", expiryDate:"",
  });
  const set = (f) => (e) => setForm(s => ({ ...s, [f]: e.target.value }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await encumbrancesApi.getByParcel("all");
        setItems(res.data.data);
      } catch { setItems(DEMO_ENCUMBRANCES); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleDischarge = async (id) => {
    try {
      await encumbrancesApi.discharge(id, { dischargeDate: new Date().toISOString().slice(0,10) });
      setItems(i => i.map(e => e.encumbranceID === id ? { ...e, status:"DISCHARGED" } : e));
    } catch { alert("Discharge failed."); }
  };

  const handleRegister = async () => {
    setError("");
    try {
      const res = await encumbrancesApi.register({ ...form, amountKES: Number(form.amountKES) });
      setItems(i => [...i, res.data.data]);
      setMode("list");
    } catch (e) {
      setError(e.response?.data?.message || "Registration failed.");
    }
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Encumbrance Manager"
        subtitle="Register and discharge financial claims against land parcels"
        action={mode === "list" && <Button onClick={() => setMode("register")}>+ Register Encumbrance</Button>}
      />

      {mode === "list" ? (
        <>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <StatCard label="Total Active"     value={items.filter(e=>e.status==="ACTIVE").length}     icon="🔒" />
            <StatCard label="Discharged"       value={items.filter(e=>e.status==="DISCHARGED").length} icon="🔓" />
            <StatCard label="Expiring in 90d"  value="0" icon="⏰" />
          </div>
          <Card>
            {loading ? <Spinner /> : items.length === 0 ? (
              <EmptyState icon="🔓" title="No encumbrances" message="No encumbrances have been registered yet." />
            ) : (
              <table className="data-table">
                <thead><tr>{["ID","Parcel","Type","Creditor","Amount (KES)","Registered","Status",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.encumbranceID}>
                      <td className="monospace">{e.encumbranceID}</td>
                      <td className="monospace" style={{fontSize:11}}>{e.parcelID}</td>
                      <td><Badge status={e.encumbranceType} /></td>
                      <td>{e.creditorName}</td>
                      <td style={{fontWeight:500}}>{e.amount > 0 ? `KES ${e.amount.toLocaleString()}` : "—"}</td>
                      <td style={{color:C.textSecondary}}>{e.registrationDate}</td>
                      <td><Badge status={e.status} /></td>
                      <td>{e.status === "ACTIVE" && <Button variant="secondary" small onClick={() => handleDischarge(e.encumbranceID)}>Discharge</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : (
        <div style={{ maxWidth: 540 }}>
          <Button variant="ghost" small onClick={() => setMode("list")}>← Back to list</Button>
          <Card style={{ marginTop: 16 }}>
            <h3 style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 16 }}>Register New Encumbrance</h3>
            {error && <Alert type="danger">{error}</Alert>}
            <FormField label="Parcel Title Number" name="parcelID" placeholder="KE/NAI/2023/0180" value={form.parcelID} onChange={set("parcelID")} required />
            <SelectField label="Encumbrance Type" name="encumbranceType" value={form.encumbranceType} onChange={set("encumbranceType")} options={[{value:"MORTGAGE",label:"Mortgage"},{value:"LIEN",label:"Lien"},{value:"CAVEAT",label:"Caveat"},{value:"EASEMENT",label:"Easement"}]} required />
            <FormField label="Creditor Name" name="creditorName" placeholder="Bank or individual name" value={form.creditorName} onChange={set("creditorName")} required />
            <FormField label="Creditor ID / Institution Code" name="creditorID" placeholder="National ID or reg. number" value={form.creditorID} onChange={set("creditorID")} required />
            <FormField label="Amount (KES)" name="amountKES" type="number" placeholder="0 for non-monetary" value={form.amountKES} onChange={set("amountKES")} />
            <div className="grid-2">
              <FormField label="Registration Date" name="registrationDate" type="date" value={form.registrationDate} onChange={set("registrationDate")} required />
              <FormField label="Expiry Date (optional)" name="expiryDate" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
            </div>
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <Button variant="secondary" full onClick={() => setMode("list")}>Cancel</Button>
              <Button full onClick={handleRegister}>Register on Blockchain</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default EncumbranceManager;
