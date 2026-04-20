import { Link } from "react-router-dom";
import Badge from "./Badge";
import { C, font } from "../../styles/tokens";

export default function ParcelCard({ parcel }) {
  const {
    parcelID,
    titleNumber,
    county,
    subCounty,
    ward,
    status,
    areaHectares,
    landUseType,
    gpsCoordinates,
    blockchainRef,
    owner // ✅ NEW (comes from backend)
  } = parcel;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      transition: "box-shadow 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        
        <div style={{ flex: 1 }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: font.mono, fontSize: 13, color: C.teal, fontWeight: 500 }}>
              {titleNumber}
            </span>

            <Badge status={status} />

            <span style={{
              fontSize: 12,
              color: C.textSecondary,
              background: C.bg,
              padding: "1px 8px",
              borderRadius: 10,
            }}>
              {landUseType}
            </span>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            
            <span style={{ fontSize: 13, color: C.textSecondary }}>
              📍 {county}{subCounty ? ` — ${subCounty}` : ""}
            </span>

            <span style={{ fontSize: 13, color: C.textSecondary }}>
              📐 {areaHectares} ha
            </span>

            {/* ✅ OWNER (NO FETCH NEEDED) */}
            {owner?.fullName && (
              <span style={{ fontSize: 13, color: C.textSecondary }}>
                👤 {owner.fullName}
              </span>
            )}

          </div>
        </div>

        <Link
          to={`/parcels/${parcelID}`}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: "#fff",
            color: C.navy,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "nowrap",
            flexShrink: 0,
            marginLeft: 16,
          }}
        >
          View Details →
        </Link>

      </div>
    </div>
  );
}