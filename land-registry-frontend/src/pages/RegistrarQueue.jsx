import { useState, useEffect, useCallback } from "react";
import { PageHeader, StatCard, Card } from "../components/ui/Card";
import { Alert, Spinner, EmptyState } from "../components/ui/Feedback";
import { TextArea } from "../components/ui/FormField";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { registrarApi , transfersApi } from "../api/services";
import { C, font } from "../styles/tokens";

export default function RegistrarQueue() {
  const [queue,    setQueue]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason,   setReason]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [counts,   setCounts]   = useState({ approved: 0, rejected: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await registrarApi.getPending();
        setQueue(res.data.data);
      } catch {
        console.log("nothing in queue");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Auto-dismiss non-error feedback after 5s
  useEffect(() => {
    if (!feedback || feedback.type === "danger") return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // If selected item gets removed from queue, clear selection
  useEffect(() => {
    if (!selected) return;
    const stillExists = queue.find((t) => t.transfer_id === selected.transfer_id);
    if (!stillExists) setSelected(null);
  }, [queue]);

  const handleSelect = useCallback(
    (transfer) => {
      if (acting) return;
      // Clicking the same row again closes the panel
      if (selected?.transfer_id === transfer.transfer_id) {
        setSelected(null);
        setReason("");
        return;
      }
      setSelected(transfer);
      setReason("");
    },
    [acting, selected]
  );

  const handleDeselect = () => {
    if (acting) return;
    setSelected(null);
    setReason("");
  };

  const handleApprove = async () => {
    if (!selected || acting) return;
    const snap = { ...selected }; // snapshot before async state changes
    setActing(true);
    setFeedback(null);
    try {
      await transfersApi.approve(snap.transfer_id);
      setQueue((q) => q.filter((t) => t.transfer_id !== snap.transfer_id));
      setCounts((c) => ({ ...c, approved: c.approved + 1 }));
      setSelected(null);
      setReason("");
      setFeedback({
        type: "success",
        msg: `Transfer ${snap.transfer_id} approved and committed to the blockchain.`,
      });
    } catch (err) {
      setFeedback({
        type: "danger",
        msg: err.response?.data?.message || "Approval failed. Please try again.",
      });
      // Panel stays open so the registrar can retry
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected || acting) return;
    if (!reason.trim()) {
      setFeedback({ type: "warn", msg: "Please provide a reason for rejection." });
      return;
    }
    const snap = { ...selected };
    setActing(true);
    setFeedback(null);
    try {
      await transfersApi.reject(snap.transfer_id, { reason });
      setQueue((q) => q.filter((t) => t.transfer_id !== snap.transfer_id));
      setCounts((c) => ({ ...c, rejected: c.rejected + 1 }));
      setSelected(null);
      setReason("");
      setFeedback({ type: "info", msg: `Transfer ${snap.transfer_id} rejected.` });
    } catch (err) {
      setFeedback({
        type: "danger",
        msg: err.response?.data?.message || "Rejection failed. Please try again.",
      });
    } finally {
      setActing(false);
    }
  };

  function getAge(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }


  

  return (
    
    <div className="page-wrapper">
      <PageHeader
        title="Registrar Approval Queue"
        subtitle="Pending ownership transfer requests awaiting review"
      />

      {feedback && <Alert type={feedback.type}>{feedback.msg}</Alert>}

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <StatCard label="Pending Approvals"  value={queue.length}    icon="⏳" />
        <StatCard label="Approved Today"     value={counts.approved} icon="✓" />
        <StatCard label="Rejected This Week" value={counts.rejected} icon="✕" />
      </div>

      {loading ? (
        <Spinner />
      ) : queue.length === 0 ? (
        <EmptyState
          icon="✅"
          title="Queue Empty"
          message="All transfer requests have been processed."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selected ? "1fr 1fr" : "1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* ── Queue list ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {queue.map((t) => (
              <Card
                key={t.transfer_id}
                style={{
                  cursor: acting ? "not-allowed" : "pointer",
                  border: `1px solid ${
                    selected?.transfer_id === t.transfer_id ? C.navy : C.border
                  }`,
                  opacity: acting ? 0.6 : 1,
                  transition: "border-color 0.15s, opacity 0.15s",
                }}
                onClick={() => handleSelect(t)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="monospace" style={{ fontSize: 13 }}>
                      Transfer#{t.transfer_id}
                    </span>
                    <Badge status="PENDING" />
                  </div>
                  <span style={{ fontSize: 12, color: C.textSecondary }}>
                    ⏱ {getAge(t.transferred_at)}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 5 }}>
                  <span className="monospace">Parcel#{t.parcel_id} </span>
                  {t.title_number} — {t.transfer_type}
                </p>
                <p style={{ fontSize: 13 }}>
                  {t.prev_owner_national_id}{" "}
                  <span style={{ color: C.textSecondary }}>→</span>{" "}
                  {t.new_owner_national_id}
                </p>
                {t.sale_price > 0 && (
                  <p
                    style={{
                      fontSize: 13,
                      color: C.teal,
                      fontWeight: 500,
                      marginTop: 4,
                    }}
                  >
                    KES {t.sale_price.toLocaleString()}
                  </p>
                )}
              </Card>
            ))}
          </div>

          {/* ── Detail / action panel ── */}
          {selected && (
            <Card>
              <h3
                style={{
                  fontFamily: font.head,
                  fontSize: 16,
                  fontWeight: 600,
                  color: C.navy,
                  marginBottom: 16,
                }}
              >
                Review: {selected.transfer_id}
              </h3>

              <div style={{ marginBottom: 16 }}>
                {[
                  ["Parcel",      selected.title_number],
                  ["From",        selected.prev_owner_national_id],
                  ["To",          selected.new_owner_national_id],
                  ["Type",        selected.transfer_type],
                  ["Sale Amount", selected.sale_price > 0
                    ? `KES ${selected.sale_price.toLocaleString()}`
                    : "—"],
                  ["Submitted",   selected.transferred_at],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: C.textSecondary }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v ?? "—"}</span>
                  </div>
                ))}
              </div>

              <TextArea
                label="Registrar Notes"
                name="reason"
                placeholder="Required when rejecting. Enter the reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <Button
                  variant="danger"
                  full
                  onClick={handleReject}
                  disabled={acting}
                >
                  ✕ Reject
                </Button>
                <Button
                  variant="teal"
                  full
                  onClick={handleApprove}
                  disabled={acting}
                >
                  ✓ Approve
                </Button>
              </div>

              <button
                onClick={handleDeselect}
                disabled={acting}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  color: C.textSecondary,
                  fontSize: 13,
                  cursor: acting ? "not-allowed" : "pointer",
                  opacity: acting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}