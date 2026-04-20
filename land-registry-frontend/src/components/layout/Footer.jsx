import { C } from "../../styles/tokens";

export default function Footer() {
  return (
    <footer style={{
      background: C.navy, color: "#64748B",
      padding: "24px", textAlign: "center", fontSize: 12,
    }}>
      <p>© {new Date().getFullYear()} BBLRS Kenya · Egerton University · Built on Hyperledger Fabric 2.5</p>
      <p style={{ marginTop: 4 }}>Ministry of Lands &amp; Physical Planning, Republic of Kenya</p>
    </footer>
  );
}
