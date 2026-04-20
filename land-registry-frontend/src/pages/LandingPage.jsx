import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, font } from "../styles/tokens";
import Button from "../components/ui/Button";

const FEATURES = [
  ["🔒", "Tamper-Proof Records",     "All land data is written to an immutable blockchain ledger — no record can ever be altered or deleted without a permanent trace."],
  ["🔍", "Instant Verification",     "Verify the authenticity of any title deed or ownership document in seconds using our IPFS cryptographic hash checker."],
  ["⚡", "Streamlined Transfers",    "Initiate and approve ownership transfers digitally with multi-party endorsement, eliminating paperwork and delays."],
  ["🛡", "RBAC Security",            "Six-tier role-based access ensures only authorized officers can register parcels, approve transfers, or manage encumbrances."],
  ["📋", "Complete Audit Trail",     "Every transaction is cryptographically signed and timestamped, providing irrefutable non-repudiation for legal proceedings."],
  ["📍", "GPS-Linked Records",       "Every parcel stores GPS coordinates and polygon data, making spatial queries and mapping integrations straightforward."],
];

// const STATS = [
//   ["1.2M+", "Registered Parcels"],
//   ["47",    "Counties Covered"],
//   ["98.6%", "System Uptime"],
//   ["0",     "Fraudulent Transfers"],
// ];

export default function LandingPage() {
  const navigate  = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={{
        background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 60%, #1E4A6E 100%)`,
        padding: "80px 24px 100px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Subtle radial accents */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(13,122,111,0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(194,138,26,0.10) 0%, transparent 50%)`,
        }} />

        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
          {/* Pill badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(13,122,111,0.2)", border: "1px solid rgba(13,122,111,0.4)",
            borderRadius: 20, padding: "4px 16px", marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, display: "inline-block" }} />
            <span style={{ color: "#A0D8D4", fontSize: 12, letterSpacing: "0.08em" }}>
              POWERED BY HYPERLEDGER FABRIC 2.5
            </span>
          </div>

          <h1 style={{
            fontFamily: font.head, fontSize: 48, fontWeight: 700,
            color: "#fff", lineHeight: 1.15, marginBottom: 20,
          }}>
            Kenya's Secure<br />
            <span style={{ color: "#5DCAA5" }}>Land Registry</span> System
          </h1>

          <p style={{ color: "#94A3B8", fontSize: 17, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Transparent, tamper-proof land records secured by blockchain technology.
            Search, verify, and manage land parcels with confidence.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} style={{
            display: "flex", gap: 8, maxWidth: 540, margin: "0 auto",
            background: "#fff", borderRadius: 10, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title number, county, or owner ID…"
              style={{
                flex: 1, border: "none", outline: "none",
                padding: "10px 14px", fontSize: 14,
                color: C.textPrimary, borderRadius: 6,
              }}
            />
            <Button type="submit">Search Parcels</Button>
          </form>
          <p style={{ color: "#64748B", fontSize: 12, marginTop: 12 }}>
            Try: KE/NKR/2026/0001 · Nakuru County · 12345678
          </p>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <div style={{ background: C.teal, padding: "20px 24px" }}>
        {/* <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(4,1fr)",
          textAlign: "center",
        }}>
          {STATS.map(([val, lbl], i) => (
            <div key={lbl} style={{
              padding: "8px 0",
              borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none",
            }}>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, fontFamily: font.head }}>{val}</p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{lbl}</p>
            </div>
          ))}
        </div> */}
      </div>

      {/* ── Features ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: font.head, fontSize: 32, fontWeight: 600, color: C.navy, marginBottom: 12 }}>
            Why BBLRS?
          </h2>
          <p style={{ color: C.textSecondary, maxWidth: 480, margin: "0 auto" }}>
            Built on Hyperledger Fabric to eliminate fraud, streamline transfers,
            and bring transparency to Kenya's land sector.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="card">
              <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
              <h3 style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
                {title}
              </h3>
              <p style={{ color: C.textSecondary, fontSize: 14, lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section style={{ background: C.navy, padding: "56px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: font.head, fontSize: 28, fontWeight: 600, color: "#fff", marginBottom: 16 }}>
          Ready to get started?
        </h2>
        <p style={{ color: "#94A3B8", marginBottom: 28, fontSize: 15 }}>
          Register your account and access your land records on the blockchain.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <Button variant="teal" onClick={() => navigate("/register")}>Create Account</Button>
          <Button variant="secondary" onClick={() => navigate("/verify")}>Verify a Document</Button>
        </div>
      </section>
    </div>
  );
}
