import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { parcelsApi } from "../api/services";
import { Alert, Breadcrumb } from "../components/ui/Feedback";
import { SelectField } from "../components/ui/FormField";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const MAX_MB = 10;

export default function UploadDocument() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [file,       setFile]       = useState(null);
  const [docType,    setDocType]    = useState("TITLE_DEED");
  const [dragActive, setDragActive] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null); // { cid }
  const [error,      setError]      = useState("");

  const validateFile = (f) => {
    if (!f) return "No file selected.";
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(f.type)) return "Only PDF, JPG, and PNG files are accepted.";
    if (f.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB} MB.`;
    return null;
  };

  const handleFile = (f) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError("");
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    const err = validateFile(file);
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("docType", docType);
      const res = await parcelsApi.uploadDocument(id, fd);
      setResult({ cid: res.data.data.ipfsHash });
    } catch (e) {
      setError(e.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", padding: "36px 24px" }}>
      <Breadcrumb items={[
        { label: "Search",        to: "/search"        },
        { label: "Parcel Detail", to: `/parcels/${id}` },
        { label: "Upload Document" },
      ]} />

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy }}>
          Upload Document
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14, marginTop: 4 }}>
          Attach a supporting document to parcel <span className="monospace">{id}</span>.
          The file will be stored on IPFS and its CID anchored on-chain.
        </p>
      </div>

      <Card>
        {error  && <Alert type="danger">{error}</Alert>}
        {result && (
          <Alert type="success">
            Document uploaded successfully. IPFS CID:{" "}
            <span className="monospace">{result.cid}</span>
          </Alert>
        )}

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              className={`drop-zone ${file ? "drop-zone--filled" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true);  }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("upload-input").click()}
              style={{ marginBottom: 20, borderColor: dragActive ? C.teal : undefined }}
            >
              <input
                id="upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />

              {file ? (
                <>
                  <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>📄</span>
                  <p style={{ fontWeight: 600, color: C.success, marginBottom: 3 }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: C.textSecondary }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>📂</span>
                  <p style={{ fontWeight: 500, color: C.navy, marginBottom: 4 }}>
                    Drag &amp; drop or click to select
                  </p>
                  <p style={{ fontSize: 13, color: C.textSecondary }}>
                    PDF, JPG, or PNG · Max {MAX_MB} MB
                  </p>
                </>
              )}
            </div>

            <SelectField
              label="Document Type" name="docType"
              value={docType} onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: "TITLE_DEED",            label: "Title Deed"              },
                { value: "SURVEY_MAP",             label: "Survey Map"              },
                { value: "TRANSFER_AGREEMENT",     label: "Transfer Agreement"      },
                { value: "ENCUMBRANCE_DISCHARGE",  label: "Encumbrance Discharge"   },
                { value: "OTHER",                  label: "Other"                   },
              ]}
            />

            {/* Upload progress / info */}
            {loading && (
              <div style={{
                background: C.tealLt, borderRadius: 8, padding: 14,
                marginBottom: 16, fontSize: 13, color: C.teal,
              }}>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>Processing…</p>
                <p>Uploading to IPFS and anchoring CID to the blockchain. This may take a few seconds.</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => navigate(`/parcels/${id}`)}>Cancel</Button>
              <Button full onClick={handleSubmit} disabled={!file || loading}>
                {loading ? "Uploading…" : "Upload &amp; Anchor on Blockchain"}
              </Button>
            </div>
          </>
        ) : (
          /* Success state */
          <>
            <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
              <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>🔏</span>
              <p style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
                Document Anchored
              </p>
              <p style={{ fontSize: 14, color: C.textSecondary }}>
                The document hash is now permanently recorded on the ledger.
              </p>
            </div>

            <div style={{ background: C.bg, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              {[
                ["File",      file.name],
                ["Type",      docType],
                ["IPFS CID",  result.cid],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13,
                }}>
                  <span style={{ color: C.textSecondary }}>{k}</span>
                  <span style={{
                    fontFamily: k === "IPFS CID" ? font.mono : "inherit",
                    fontSize: k === "IPFS CID" ? 11 : 13,
                    fontWeight: 500, wordBreak: "break-all", textAlign: "right", maxWidth: "65%",
                    color: k === "IPFS CID" ? C.teal : C.textPrimary,
                  }}>{v}</span>
                </div>
              ))}
            </div>

            <Button full onClick={() => navigate(`/parcels/${id}`)}>
              Back to Parcel
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
