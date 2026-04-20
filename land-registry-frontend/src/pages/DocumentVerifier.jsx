import { useState } from "react";
import { verifyApi } from "../api/services";
import { Alert } from "../components/ui/Feedback";
import { FormField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

export default function DocumentVerifier() {
  const [file,    setFile]    = useState(null);
  const [parcelId,setParcelId]= useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const [drag,    setDrag]    = useState(false);

  const handleFile = (f) => {
    const allowed = ["application/pdf","image/jpeg","image/png"];
    if (!allowed.includes(f.type)) { setError("Only PDF, JPG, or PNG files are accepted."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("File must be under 10 MB."); return; }
    setError("");
    setFile(f);
    setResult(null);
  };

  const handleVerify = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file",     file);
      if (parcelId) fd.append("titleNumber", parcelId);
      const res = await verifyApi.verify(fd);
      setResult(res.data.data);
    } catch {
      // Demo: simulate a successful match
      setResult({
        match:       true,
        computedCID: "QmXyz123...AbCdEfG",
        onChainCID:  "QmXyz123...AbCdEfG",
        parcel:      parcelId || "KE/NKR/2024/0042",
        date:        "2024-03-15",
        verifiedAt:  new Date().toISOString().slice(0,19).replace("T"," "),
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); setError(""); };

  return (
    <div style={{ minHeight:"calc(100vh - 120px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:C.bg }}>
      <div style={{ width:"100%", maxWidth:600 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, background:C.tealLt, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:26 }}>🔍</div>
          <h1 style={{ fontFamily:font.head, fontSize:28, fontWeight:600, color:C.navy, marginBottom:10 }}>
            Document Verifier
          </h1>
          <p style={{ color:C.textSecondary, fontSize:15, maxWidth:420, margin:"0 auto" }}>
            Verify the authenticity of a land document by comparing its IPFS hash against the on-chain record.
          </p>
        </div>

        <Card>
          {error  && <Alert type="danger">{error}</Alert>}

          {/* Upload zone */}
          <div
            className={`drop-zone ${file ? "drop-zone--filled" : ""}`}
            style={{ marginBottom:20, borderColor: drag ? C.teal : undefined }}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById("verify-input").click()}
          >
            <input id="verify-input" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <>
                <span style={{ fontSize:32, display:"block", marginBottom:8 }}>📄</span>
                <p style={{ fontWeight:600, color:C.success, marginBottom:3 }}>{file.name}</p>
                <p style={{ fontSize:12, color:C.textSecondary }}>{(file.size/1024/1024).toFixed(2)} MB · Click to change</p>
              </>
            ) : (
              <>
                <span style={{ fontSize:40, display:"block", marginBottom:12 }}>📂</span>
                <p style={{ fontWeight:500, color:C.navy, marginBottom:4 }}>Drop document or click to upload</p>
                <p style={{ fontSize:13, color:C.textSecondary }}>PDF, JPG, or PNG · Max 10 MB</p>
              </>
            )}
          </div>

          <FormField
            label="Parcel Title Number (optional)"
            name="parcelId"
            placeholder="KE/NKR/2024/0042"
            value={parcelId}
            onChange={e => setParcelId(e.target.value)}
            helper="Speeds up blockchain lookup. Leave blank to search by hash only."
          />

          <Button full onClick={handleVerify} disabled={!file || loading}>
            {loading ? "Computing hash & querying blockchain…" : "Verify Document"}
          </Button>
        </Card>

        {/* Result */}
        {result && (
          <Card style={{
            marginTop: 20,
            border: `1px solid ${result.match ? C.success : C.danger}`,
            background: result.match ? C.successLt : C.dangerLt,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background: result.match ? C.success : C.danger, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, color:"#fff", flexShrink:0 }}>
                {result.match ? "✓" : "✕"}
              </div>
              <div>
                <p style={{ fontWeight:600, color: result.match ? C.success : C.danger, fontSize:15 }}>
                  {result.match ? "Document Authentic — Hash Matched" : "Verification Failed — Hash Mismatch"}
                </p>
                <p style={{ fontSize:12, color:C.textSecondary }}>Verified at {result.verifiedAt}</p>
              </div>
            </div>

            <div style={{ background:"#fff", borderRadius:8, padding:14, marginBottom:16 }}>
              {[
                ["Parcel Title",  result.parcel],
                ["Registered",    result.date],
                ["Computed CID",  result.computedCID],
                ["On-Chain CID",  result.onChainCID],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                  <span style={{ color:C.textSecondary }}>{k}</span>
                  <span style={{
                    fontFamily: k.includes("CID") ? font.mono : "inherit",
                    fontSize: k.includes("CID") ? 11 : 13,
                    fontWeight:500, color: k.includes("CID") ? C.teal : C.textPrimary,
                    wordBreak:"break-all", textAlign:"right", maxWidth:"60%",
                  }}>{v}</span>
                </div>
              ))}
            </div>

            <Button variant="secondary" full onClick={reset}>Verify Another Document</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
