import { useNavigate } from "react-router-dom";
import { C, font } from "../styles/tokens";
import Button from "../components/ui/Button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight:"calc(100vh - 120px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:420 }}>
        <p style={{ fontFamily:font.head, fontSize:96, fontWeight:700, color:C.border, lineHeight:1 }}>404</p>
        <h1 style={{ fontFamily:font.head, fontSize:26, fontWeight:600, color:C.navy, marginBottom:12 }}>
          Page Not Found
        </h1>
        <p style={{ color:C.textSecondary, marginBottom:28 }}>
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <Button variant="secondary" onClick={() => navigate(-1)}>← Go Back</Button>
          <Button onClick={() => navigate("/")}>Home</Button>
        </div>
      </div>
    </div>
  );
}
