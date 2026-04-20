import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { parcelsApi } from "../api/services";
import ParcelCard from "../components/ui/ParcelCard";
import { PageHeader } from "../components/ui/Card";
import { Spinner, EmptyState } from "../components/ui/Feedback";
import { C } from "../styles/tokens";

const STATUS_FILTERS = ["ALL", "ACTIVE", "ENCUMBERED", "DISPUTED", "INACTIVE"];

// Fallback demo data when API is unavailable
// const DEMO_PARCELS = [
//   { parcelID: "a1b2", titleNumber: "KE/NKR/2024/0042", county: "Nakuru",  subCounty: "Nakuru East",    areaHectares: 0.25, landUseType: "RESIDENTIAL",  currentOwner: { fullName: "John Kamau"        }, status: "ACTIVE"     },
//   { parcelID: "b2c3", titleNumber: "KE/NAI/2023/0180", county: "Nairobi", subCounty: "Westlands",       areaHectares: 0.12, landUseType: "COMMERCIAL",   currentOwner: { fullName: "Acme Ltd."         }, status: "ENCUMBERED" },
//   { parcelID: "c3d4", titleNumber: "KE/KSM/2022/0099", county: "Kisumu",  subCounty: "Kisumu Central",  areaHectares: 1.80, landUseType: "AGRICULTURAL", currentOwner: { fullName: "Mary Otieno"       }, status: "ACTIVE"     },
//   { parcelID: "d4e5", titleNumber: "KE/MOM/2024/0015", county: "Mombasa", subCounty: "Mvita",           areaHectares: 0.08, landUseType: "COMMERCIAL",   currentOwner: { fullName: "Coast Developers"  }, status: "DISPUTED"  },
//   { parcelID: "e5f6", titleNumber: "KE/NAK/2021/0250", county: "Nakuru",  subCounty: "Gilgil",          areaHectares: 4.50, landUseType: "AGRICULTURAL", currentOwner: { fullName: "Samuel Njoroge"    }, status: "ACTIVE"     },
// ];

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

  const LIMIT = 10;

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const res = await parcelsApi.search({
        q: query,
        status: status !== "ALL" ? status : undefined,
        page,
        limit: LIMIT,
      });

      setParcels(res.data.data);
      setTotal(res.data.total);
      setPaywall(false);

    } catch (err) {
      if (err.response?.status === 402) {
        setPaywall(true);
      }
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
          {parcels.map((p) => <ParcelCard key={p.parcel_id} parcel={p} />)}
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
      {paywall && (
        <Card style={{ marginBottom: 16, border: "2px solid #f0c040" }}>
          <h3>🔒 Paywall Required</h3>
          <p>Pay KES 20 to view parcel results</p>

          <input
            placeholder="07XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />

          <Button
            disabled={paymentLoading}
            onClick={async () => {
              setPaymentLoading(true);
              try {
                await parcelsApi.mpesaSearchPay({
                  phone,
                  query,
                });

                alert("STK Push sent. Complete payment on phone.");
              } finally {
                setPaymentLoading(false);
              }
            }}
          >
            Pay with M-Pesa
          </Button>
        </Card>
      )}
    </div>

  );
}
