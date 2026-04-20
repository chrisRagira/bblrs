import ipfs from "../config/ipfs.js";
import { submitTx } from "../fabric.js";

export const uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    const { parcel_id } = req.body;

    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // 📤 Upload to IPFS
    const result = await ipfs.add(file.buffer);

    const cid = result.path; // IPFS hash

    // 🔗 Store CID on Fabric
    const { txId } = await submitTx(
      "logEvent",
      "DOCUMENT_UPLOAD",
      req.user.id.toString(),
      "PARCEL",
      parcel_id
    );

    // 💾 Save in MySQL
    await req.db.execute(
      `INSERT INTO documents 
      (parcel_id, owner_id, file_name, cid)
      VALUES (?, ?, ?, ?)`,
      [parcel_id, req.user.id, file.originalname, cid]
    );

    res.json({
      message: "Document uploaded",
      cid,
      txId,
      ipfsUrl: `https://ipfs.io/ipfs/${cid}`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDocuments = async (req, res) => {
  const { parcel_id } = req.params;

  const [rows] = await req.db.execute(
    "SELECT * FROM documents WHERE parcel_id=?",
    [parcel_id]
  );

  res.json({ data: rows });
};