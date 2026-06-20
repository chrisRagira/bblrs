import { C } from "../../styles/tokens";
import { Link,useNavigate } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={{
      background: C.navy, color: "#64748B",
      padding: "24px", textAlign: "center", fontSize: 12,
    }}>
      <p>
        <Link to='/faq'>Need Help ?</Link>
      </p>
      <p>© {new Date().getFullYear()} BBLRS Kenya · Egerton University · Built on Hyperledger Fabric 2.5</p>
      <p style={{ marginTop: 4 }}>Ministry of Lands &amp; Physical Planning, Republic of Kenya</p>
    </footer>
  );
}
