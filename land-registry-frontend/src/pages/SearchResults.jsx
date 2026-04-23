import { useState, useEffect,useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { parcelsApi } from "../api/services";
import ParcelCard from "../components/ui/ParcelCard";
import { PageHeader } from "../components/ui/Card";
import { Spinner, EmptyState } from "../components/ui/Feedback";
import { C } from "../styles/tokens";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

const STATUS_FILTERS = ["ALL", "ACTIVE", "ENCUMBERED", "DISPUTED", "INACTIVE"];


export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query,    setQuery]    = useState(searchParams.get("q") || "");
  const [status,   setStatus]   = useState("ALL");
  const [parcels,  setParcels]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [paywall, setPaywall] = useState(false);
  const [phone, setPhone] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentId,      setPaymentId]      = useState(null);
  const [paymentStatus,  setPaymentStatus]  = useState(null); // PENDING | PAID | FAILED
  const pollRef = useRef(null);
  const LIMIT = 10;


  const startPolling = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await parcelsApi.pollPayStatus(id);

        if (res.data.status === "PAID") {
          clearInterval(pollRef.current);
          setPaymentStatus("PAID");
          setPaywall(false);
          fetchParcels(id); // pass id directly — state update may not have flushed yet
        }

        if (res.data.status === "FAILED") {
          clearInterval(pollRef.current);
          setPaymentStatus("FAILED");
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, 3000);
  };

  // Clean up on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);



  const fetchParcels = async (explicitPaymentId) => {
    setLoading(true);
    try {
      const res = await parcelsApi.search({
        q:         query,
        status:    status !== "ALL" ? status : undefined,
        page,
        limit:     LIMIT,
        // prefer the directly-passed id so we don't rely on stale state
        paymentId: explicitPaymentId ?? paymentId ?? undefined,
      });
      setParcels(res.data.data);
      setTotal(res.data.total);
      setPaywall(false);
    } catch (err) {
      if (err.response?.status === 402) setPaywall(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParcels(); }, [status, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchParams({ q: query });
    fetchParcels();
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Parcel Search"
        subtitle="Browse and filter registered land parcels across Kenya"
      />

      {/* Search + Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 260, display: "flex", gap: 8 }}>
          <div className="input-wrapper" style={{ flex: 1 }}>
            <span className="input-icon">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title number, county, or owner id"
              className="form-control form-control--icon"
            />
          </div>
          <button type="submit" className="btn btn--primary btn--sm">Search</button>
        </form>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setStatus(f); setPage(1); }}
              style={{
                padding: "9px 15px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                border: `1px solid ${status === f ? C.navy : C.border}`,
                background: status === f ? C.navy : "#fff",
                color: status === f ? "#fff" : C.textPrimary,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {f === "ALL" ? "All Status" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>
        {loading ? "Searching…" : `${total} parcel${total !== 1 ? "s" : ""} found`}
      </p>

      {/* Results */}
      {loading ? (
        <Spinner />
      ) : parcels.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="No parcels found"
          message="Try adjusting your search query or status filter."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {parcels.map((p) => <ParcelCard key={p.parcelID} parcel={p} paymentId={paymentId} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center",
          alignItems: "center", gap: 6, marginTop: 28,
        }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn--secondary btn--sm"
          >← Prev</button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 36, height: 36, borderRadius: 6, fontSize: 13,
                border: `1px solid ${page === p ? C.navy : C.border}`,
                background: page === p ? C.navy : "#fff",
                color: page === p ? "#fff" : C.textPrimary,
                cursor: "pointer",
              }}
            >{p}</button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn--secondary btn--sm"
          >Next →</button>
        </div>
      )}

      {/* Paywall — full-screen overlay modal that covers all content */}
      {paywall && (
        <>
          <style>{`
            @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.3} }
            @keyframes modalIn  {
              from { opacity: 0; transform: translateY(16px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
          `}</style>

          {/* Backdrop — fixed, covers entire viewport, blurs everything beneath */}
          <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgba(10, 20, 45, 0.60)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}>
            {/* Modal card */}
            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: "32px 28px",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              animation: "modalIn 0.25s ease both",
            }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: C.goldLt,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                  fontSize: 26,
                  border: `2px solid ${C.gold}`,
                }}>
                  🔒
                </div>
                <p style={{ fontWeight: 700, color: C.navy, fontSize: 17, marginBottom: 6 }}>
                  Search requires payment
                </p>
                <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>
                  Pay <strong>KES 20</strong> via M-Pesa to unlock these results.
                  Access is valid for <strong>30 minutes</strong>.
                </p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: C.border, marginBottom: 20 }} />

              {/* Error state */}
              {paymentStatus === "FAILED" && (
                <div style={{
                  background: C.dangerLt, color: C.danger,
                  padding: "10px 12px", borderRadius: 8,
                  marginBottom: 16, fontSize: 13,
                }}>
                  ⚠️ Payment failed or was cancelled. Please try again.
                </div>
              )}

              {/* Pending — waiting for M-Pesa PIN */}
              {paymentStatus === "PENDING" ? (
                <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                  <p style={{ fontWeight: 600, color: C.navy, marginBottom: 6, fontSize: 15 }}>
                    Check your phone
                  </p>
                  <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
                    Enter your M-Pesa PIN to complete the KES 20 payment
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: C.teal, animation: "pulse 1.2s infinite",
                    }} />
                    <span style={{ fontSize: 13, color: C.teal, fontWeight: 500 }}>
                      Waiting for payment…
                    </span>
                  </div>
                </div>
              ) : (
                /* Phone input + pay button */
                <>
                  <label style={{
                    display: "block", fontSize: 12, fontWeight: 600,
                    color: C.textSecondary, marginBottom: 6,
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>
                    M-Pesa Phone Number
                  </label>
                  <input
                    placeholder="07XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-control"
                    style={{ marginBottom: 14 }}
                  />
                  <Button
                    full
                    disabled={paymentLoading || !phone}
                    onClick={async () => {
                      setPaymentLoading(true);
                      setPaymentStatus(null);
                      try {
                        const res = await parcelsApi.mpesaSearchPay({ phone, query });
                        setPaymentId(res.data.paymentId);
                        setPaymentStatus("PENDING");
                        startPolling(res.data.paymentId);
                      } catch (err) {
                        alert(err.response?.data?.message || "Payment initiation failed.");
                      } finally {
                        setPaymentLoading(false);
                      }
                    }}
                  >
                    {paymentLoading ? "Sending STK Push…" : "Pay KES 20 with M-Pesa"}
                  </Button>

                  <p style={{
                    fontSize: 11, color: C.textSecondary,
                    textAlign: "center", marginTop: 12, lineHeight: 1.5,
                  }}>
                    You'll receive an STK push prompt on your phone.
                    No data is stored after your session expires.
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}