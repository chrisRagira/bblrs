// ParcelCard.jsx
// Accepts an optional `paymentId` prop and threads it into the detail link.
// If no paymentId is present the card still renders, but the link won't work
// past the server's 402 gate — consistent with the search paywall behaviour.

import { Link } from "react-router-dom";
import { C } from "../../styles/tokens";

const STATUS_COLORS = {
  ACTIVE:     { bg: "#e6f4ea", color: "#1e7e34" },
  ENCUMBERED: { bg: "#fff3cd", color: "#856404" },
  DISPUTED:   { bg: "#fde8e8", color: "#b91c1c" },
  INACTIVE:   { bg: "#f1f1f1", color: "#6b7280" },
};

export default function ParcelCard({ parcel, paymentId }) {
  const badge = STATUS_COLORS[parcel.status] ?? STATUS_COLORS.INACTIVE;

  // Build the detail URL — include paymentId so the server accepts the request
  const detailPath = paymentId
    ? `/parcels/${parcel.parcelID}?paymentId=${paymentId}`
    : `/parcels/${parcel.parcelID}`;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: C.navy, fontSize: 15 }}>
            {parcel.title_number ?? parcel.titleNumber}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px",
            borderRadius: 20, background: badge.bg, color: badge.color,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {parcel.status}
          </span>
        </div>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0 }}>
          {[parcel.county, parcel.sub_county ?? parcel.subCounty, parcel.ward]
            .filter(Boolean).join(" · ")}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: C.textSecondary }}>
          {parcel.area_hectares ?? parcel.areaHectares} ha
        </span>
        <Link
          to={detailPath}
          style={{
            padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: C.navy, color: "#fff", textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}