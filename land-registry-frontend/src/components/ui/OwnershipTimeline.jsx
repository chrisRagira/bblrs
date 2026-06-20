import { C, font } from "../../styles/tokens";

export default function OwnershipTimeline({ records = [] }) {
  if (!records.length) {
    return (
      <p style={{ color: C.textSecondary, fontSize: 14, textAlign: "center", padding: "24px 0" }}>
        No ownership history available.
      </p>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {records.map((rec, i) => (
        <div key={rec.transfer_id || i} style={{ display: "flex", gap: 20, marginBottom: i < records.length - 1 ? 0 : 0 }}>
          {/* Timeline spine */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
              background: i === 0 ? C.teal : C.border,
              border: `2px solid ${i === 0 ? C.teal : C.border}`,
              zIndex: 1, marginTop: 4,
            }} />
            {i < records.length - 1 && (
              <div style={{ width: 2, flex: 1, minHeight: 36, background: C.border, marginTop: 4 }} />
            )}
          </div>

          {/* Record content */}
          <div style={{ flex: 1, paddingBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{
                  fontSize: 12, background: C.bg, color: C.navy,
                  padding: "2px 8px", borderRadius: 4,
                  fontWeight: 500, display: "inline-block", marginBottom: 6,
                }}>
                  {rec.transfer_type || rec.type}
                </span>
                <p style={{ fontSize: 14, color: C.textSecondary }}>
                  <strong style={{ color: C.textPrimary }}>{rec.prev_owner_last_name+' '+rec.prev_owner_first_name || rec.from}</strong>
                  {" → "}
                  <strong style={{ color: C.textPrimary }}>{rec.new_owner_last_name +' '+rec.new_owner_first_name || rec.to}</strong>
                </p>
                {rec.sale_price > 0 && (
                  <p style={{ fontSize: 13, color: C.teal, fontWeight: 500, marginTop: 3 }}>
                    KES {rec.sale_price.toLocaleString()}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <p style={{ fontSize: 12, color: C.textSecondary }}>{rec.transferred_at || rec.date}</p>
                {rec.transferred_at && (
                  <p style={{ fontFamily: font.mono, fontSize: 10, color: C.textSecondary, marginTop: 3 }}>
                    {rec.transfer_id}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
