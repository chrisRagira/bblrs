import { useState, useEffect } from "react";
import { adminApi } from "../api/services";
import { PageHeader, Card } from "../components/ui/Card";
import { Spinner, EmptyState } from "../components/ui/Feedback";
import { FormField, SelectField } from "../components/ui/FormField";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const DEMO_EVENTS = [
  { eventTime:"2025-04-11 10:42:31", eventType:"TRANSFER_APPROVED",      actorID:"Reg. Wanjiku",   targetEntity:"KE/NKR/2024/0042", txID:"a9f3c2...8e7d" },
  { eventTime:"2025-04-11 09:15:08", eventType:"PARCEL_CREATED",         actorID:"Reg. Omondi",    targetEntity:"KE/MOM/2025/0020", txID:"b8e4d1...7f6c" },
  { eventTime:"2025-04-10 16:30:55", eventType:"ENCUMBRANCE_REGISTERED", actorID:"KCB Bank",       targetEntity:"KE/NAI/2023/0180", txID:"c7d5e2...6a5b" },
  { eventTime:"2025-04-10 14:20:18", eventType:"TRANSFER_INITIATED",     actorID:"John Kamau",     targetEntity:"KE/NKR/2024/0042", txID:"d6c4b3...5e4a" },
  { eventTime:"2025-04-10 11:05:44", eventType:"LOGIN_SUCCESS",          actorID:"Admin Njuguna",  targetEntity:"AUTH",            txID:"—"             },
  { eventTime:"2025-04-09 08:55:30", eventType:"TRANSFER_REJECTED",      actorID:"Reg. Wanjiku",   targetEntity:"KE/KSM/2022/0099", txID:"e5b3a2...4d3c" },
];

const EVENT_COLORS = {
  TRANSFER_APPROVED:      "#276749",
  TRANSFER_REJECTED:      "#C53030",
  PARCEL_CREATED:         "#0D7A6F",
  ENCUMBRANCE_REGISTERED: "#92400E",
  TRANSFER_INITIATED:     "#1D4ED8",
  LOGIN_SUCCESS:          "#64748B",
};

export default function AuditLog() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q:"", from:"", to:"", type:"" });
  const setF = (f) => (e) => setFilters(s => ({ ...s, [f]: e.target.value }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.getAuditLog(filters);
        setEvents(res.data.data);
      } catch { setEvents(DEMO_EVENTS); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleExport = () => {
    const csv = ["Timestamp,Event Type,Actor,Target,TxID",
      ...events.map(e => `"${e.eventTime}","${e.eventType}","${e.actorID}","${e.targetEntity}","${e.txID}"`)
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "audit_log.csv";
    a.click();
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Audit Log"
        subtitle="Tamper-proof record of all system events from the blockchain"
        action={<Button variant="secondary" onClick={handleExport}>Export CSV</Button>}
      />

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <div style={{ flex:1, minWidth:220, position:"relative" }}>
          <span className="input-icon">🔍</span>
          <input value={filters.q} onChange={setF("q")} placeholder="Filter by actor, parcel, event type…" className="form-control form-control--icon" />
        </div>
        <FormField name="from" type="date" value={filters.from} onChange={setF("from")} label="" />
        <FormField name="to"   type="date" value={filters.to}   onChange={setF("to")}   label="" />
        <SelectField name="type" value={filters.type} onChange={setF("type")} options={[
          {value:"",label:"All Event Types"},
          {value:"TRANSFER",label:"Transfers"},
          {value:"PARCEL",label:"Parcels"},
          {value:"ENCUMBRANCE",label:"Encumbrances"},
          {value:"AUTH",label:"Authentication"},
        ]} />
      </div>

      <Card>
        {loading ? <Spinner /> : events.length === 0 ? (
          <EmptyState icon="📋" title="No events found" message="Try adjusting your filters." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>{["Timestamp","Event Type","Actor","Target Entity","Transaction ID"].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const col = EVENT_COLORS[e.eventType] || "#64748B";
                return (
                  <tr key={i}>
                    <td style={{fontFamily:font.mono, fontSize:12, color:C.textSecondary}}>{e.eventTime}</td>
                    <td><span style={{color:col, fontWeight:500, fontSize:12}}>● {e.eventType.replace(/_/g," ")}</span></td>
                    <td>{e.actorID}</td>
                    <td className="monospace">{e.targetEntity}</td>
                    <td className="monospace" style={{fontSize:11}}>{e.txID}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
