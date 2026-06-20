import express from "express";
import upload from "../middleware/upload.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { submitTx, evaluateTx } from "../fabric.js";
import ipfs from "../config/ipfs.js";
const router = express.Router();

// ─── Public Search ───────────────────────────────────────────────────────────
import { v4 as uuidv4 } from "uuid";
import { stkPush }      from "../utils/mpesa.js";

const SEARCH_AMOUNT = 1; // KES — use 1 for sandbox testing, 20 for prod

// ── POST /parcels/mpesa-search-pay ──────────────────────────────────────────
router.post("/mpesa-search-pay", async (req, res) => {
  const { phone, query } = req.body;

  if (!phone || !query) {
    return res.status(400).json({ message: "Phone and query are required." });
  }

  const paymentId = uuidv4();

  try {
    const result = await stkPush({
      phone,
      amount:      SEARCH_AMOUNT,
      accountRef:  "BBLRS-SEARCH",
      description: "Parcel Search Fee",
      callbackUrl: `${process.env.APP_URL}/api/v1/parcels/mpesa-callback`,
    });
    console.log("STK Push initiated:", result);

    if (result.ResponseCode !== "0") {
      return res.status(400).json({ message: result.ResponseDescription });
    }

    // Save pending payment
    await req.db.execute(
      `INSERT INTO search_payments (id, phone, query, status, checkout_request_id, expires_at)
      VALUES (?, ?, ?, 'PENDING', ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [paymentId, phone, query, result.CheckoutRequestID]
    );

    return res.json({
      message:   "STK Push sent. Complete payment on your phone.",
      paymentId,                        // frontend polls with this
      checkoutRequestId: result.CheckoutRequestID,
    });

  } catch (err) {
    console.error("M-Pesa STK error:", err.response?.data || err.message);
    return res.status(500).json({ message: "Failed to initiate payment." });
  }
});

// ── POST /parcels/mpesa-callback ─────────────────────────────────────────────
// Safaricom posts here — must be a public HTTPS URL (use ngrok in dev)
router.post("/mpesa-callback", async (req, res) => {
  // Always respond 200 immediately — Safaricom retries if you don't
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const body     = req.body.Body?.stkCallback;
    const checkoutId = body?.CheckoutRequestID;
    const resultCode = body?.ResultCode; // 0 = success, anything else = failed/cancelled

    if (!checkoutId) return;

    const status = resultCode === 0 ? "PAID" : "FAILED";

    await req.db.execute(
      `UPDATE search_payments SET status = ? WHERE checkout_request_id = ?`,
      [status, checkoutId]
    );

    console.log(`Payment ${checkoutId} → ${status}`);
  } catch (err) {
    console.error("Callback error:", err.message);
  }
});

// ── GET /parcels/mpesa-pay-status/:paymentId ─────────────────────────────────
// Frontend polls this every 3 seconds to know when payment completes
router.get("/mpesa-pay-status/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  const [rows] = await req.db.execute(
    `SELECT status, query FROM search_payments WHERE id = ? AND expires_at > NOW()`,
    [paymentId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Payment not found or expired." });
  }

  return res.json({ status: rows[0].status, query: rows[0].query });
});

// ── GET /parcels/search ──────────────────────────────────────────────────────
// Update your existing search route to check for payment
router.get("/search", verifyToken, async (req, res) => {
  const { q, status, page = 1, limit = 10, paymentId } = req.query;

  if (!q || q.trim() === "") {
    return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
  }

  // Registrars bypass payment entirely
  const isRegistrar = req.user?.role === "REGISTRAR";
  console.log(isRegistrar)

  if (!isRegistrar) {
    if (paymentId) {
      const [rows] = await req.db.execute(
        `SELECT status FROM search_payments
         WHERE id = ? AND query = ? AND expires_at > NOW()`,
        [paymentId, q.trim()]
      );

      if (rows.length === 0 || rows[0].status !== "PAID") {
        return res.status(402).json({ message: "Payment required or not confirmed yet." });
      }
    } else {
      return res.status(402).json({ message: "Payment required to search." });
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params     = [];
  const like       = `%${q}%`;

  conditions.push(`(p.title_number LIKE ? OR p.county LIKE ? OR u.national_id LIKE ?)`);
  params.push(like, like, like);

  if (status && status !== "ALL") {
    conditions.push(`p.status = ?`);
    params.push(status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [[{ total }]] = await req.db.execute(
    `SELECT COUNT(*) AS total FROM parcels p JOIN users u ON p.owner_id = u.user_id ${where}`,
    params
  );

  const [rows] = await req.db.execute(
    `SELECT p.parcel_id, p.title_number, p.owner_id, p.county, p.sub_county,
            p.ward, p.status, p.area_hectares, p.land_use_type,
            p.gps_coordinates, p.blockchain_ref,
            u.user_id AS owner_user_id, u.first_name AS owner_first_name, u.last_name AS owner_last_name
     FROM parcels p JOIN users u ON p.owner_id = u.user_id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const data = rows.map(row => ({
    parcelID:     row.parcel_id,
    titleNumber:  row.title_number,
    county:       row.county,
    subCounty:    row.sub_county,
    ward:         row.ward,
    status:       row.status,
    areaHectares: row.area_hectares,
    landUseType:  row.land_use_type,
    owner:        { userID: row.owner_user_id, firstName: row.owner_first_name, lastName: row.owner_last_name },
  }));

  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

// ─── Get Parcel Details (Payment-gated) ──────────────────────────────────────

router.get("/:id", verifyToken, async (req, res) => {
  try {
    // Fetch the parcel first — we need owner_id before we can decide on payment
    const [rows] = await req.db.execute(
      `
      SELECT 
        p.parcel_id,
        p.title_number,
        p.owner_id,
        p.county,
        p.sub_county,
        p.ward,
        p.status,
        p.area_hectares,
        p.land_use_type,
        p.gps_coordinates,
        p.blockchain_ref,
        p.created_at,

        u.user_id   AS owner_user_id,
        u.first_name AS owner_first_name,
        u.last_name AS owner_last_name,
        u.email     AS owner_email

      FROM parcels p
      JOIN users u ON p.owner_id = u.user_id
      WHERE p.parcel_id = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Parcel not found" });
    }

    const row = rows[0];

    const isRegistrar = req.user?.role === "REGISTRAR";
    const isOwner     = req.user?.userId === row.owner_user_id;
    console.log("Requester:", req.user);
    console.log("Parcel Owner ID:", row.owner_user_id);
    console.log(isRegistrar);
    console.log(isOwner);

    // Only enforce payment if the requester is neither a registrar nor the owner
    if (!isRegistrar && !isOwner) {
      const { paymentId } = req.query;

      if (!paymentId) {
        return res.status(402).json({ message: "Payment required to view parcel details." });
      }

      const [payRows] = await req.db.execute(
        `SELECT id FROM search_payments
         WHERE id = ? AND status = 'PAID' AND expires_at > NOW()
         LIMIT 1`,
        [paymentId]
      );

      if (!payRows.length) {
        return res.status(402).json({ message: "Payment required or session expired." });
      }
    }

    res.json({
      data: {
        parcelID:       row.parcel_id,
        titleNumber:    row.title_number,
        ownerID:        row.owner_id,
        county:         row.county,
        subCounty:      row.sub_county,
        ward:           row.ward,
        status:         row.status,
        areaHectares:   row.area_hectares,
        landUseType:    row.land_use_type,
        gpsCoordinates: row.gps_coordinates,
        blockchainRef:  row.blockchain_ref,
        createdAt:      row.created_at,
        owner: {
          userID:   row.owner_user_id,
          first_name: row.owner_first_name,
          last_name: row.owner_last_name,
          email:    row.owner_email,
          nationalId:    row.owner_national_id,
        },
      },
    });

  } catch (error) {
    console.error("Parcel fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Create Parcel (REGISTRAR only) ──────────────────────────────────────────

router.post(
  "/",
  verifyToken,
  authorizeRoles("REGISTRAR",'CLERK'),
  upload.single("document"),
  async (req, res) => {
    try {
      let {
        titleNumber,
        county,
        subCounty,
        ward,
        areaHectares,
        landUseType,
        gpsCoordinates,
        ownerNationalId,
        registrationDate
      } = req.body;

      const file = req.file;

      if (gpsCoordinates && typeof gpsCoordinates === "string") {
        try {
          gpsCoordinates = JSON.parse(gpsCoordinates);
        } catch (e) {
          return res.status(400).json({
            message: "Invalid gpsCoordinates format. Must be valid JSON."
          });
        }
      }

      if (!titleNumber || !ownerNationalId || !county) {
        return res.status(400).json({
          message: "Missing required fields (titleNumber, ownerNationalId, county)"
        });
      }

      const [users] = await req.db.execute(
        "SELECT user_id, first_name, last_name FROM users WHERE national_id=?",
        [ownerNationalId]
      );

      if (users.length === 0) {
        return res.json({ message: "Owner not found" });
      }

      const owner = users[0];

      let cid = null;
      if (file) {
        const result = await ipfs.add(file.buffer);
        cid = result.path;
      }

      console.log(req)

      const { txId } = await submitTx(
        "createParcel",
        titleNumber,
        county,
        subCounty || "",
        ward || "",
        areaHectares ? areaHectares.toString() : "0",
        landUseType,
        JSON.stringify(gpsCoordinates || {}),
        ownerNationalId,
        registrationDate || "",
        req.user.userId.toString(),
        cid || ""
      );

      await req.db.execute(
        `INSERT INTO parcels 
        (title_number, owner_id, county, sub_county, ward, status, area_hectares, land_use_type, gps_coordinates, blockchain_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          titleNumber,
          owner.user_id,
          county,
          subCounty || null,
          ward || null,
          "ACTIVE",
          areaHectares || null,
          landUseType,
          gpsCoordinates || null,
          txId
        ]
      );

      if (cid) {
        await req.db.execute(
          `INSERT INTO documents 
          (parcel_id, owner_id, file_name, cid)
          VALUES (?, ?, ?, ?)`,
          [titleNumber, owner.user_id, file.originalname, cid]
        );
      }

      await req.db.execute(
        `INSERT INTO audit_logs 
        (entity, entity_id, action, actor_id, blockchain_ref)
        VALUES (?, ?, ?, ?, ?)`,
        ["PARCEL", titleNumber, "CREATE_WITH_DOC", req.user.userId, txId]
      );

      return res.status(201).json({
        message: "Parcel created successfully",
        titleNumber,
        txId,
        cid,
        ipfsUrl: cid
          ? `https://8080-01kmcr59jamcx2p9mvdbn0h329.cloudspaces.litng.ai/ipfs/${cid}`
          : null
      });

    } catch (error) {
      console.error("🔥 FABRIC TX ERROR FULL:", {
        message: error.message,
        stack: error.stack,
        details: error.details
      });
      return res.status(500).json({
        message: error.message || "Failed to create parcel",
        error: error.details || null
      });
    }
  }
);

// ─── Ownership History (Blockchain) ──────────────────────────────────────────

router.get("/:id/history", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
    "SELECT * FROM parcels WHERE parcel_id=?",
    [req.params.id]
  );
  const titleNumber=rows[0].title_number
    const raw = await evaluateTx("getOwnershipHistory", titleNumber);
    const history = JSON.parse(raw);

    // res.json({
    //   data: history
    // });

    try {
      const [rows] = await req.db.execute(
        `SELECT t.*, p.title_number, p.county,
                s.first_name AS prev_owner_first_name, s.last_name AS prev_owner_last_name,
                b.first_name AS new_owner_first_name, b.last_name AS new_owner_last_name
        FROM transfers t
        JOIN parcels p ON t.parcel_id = p.parcel_id
        JOIN users s   ON t.previous_owner_id = s.user_id
        JOIN users b   ON t.new_owner_id  = b.user_id
        WHERE t.status = 'APPROVED' AND (t.parcel_id = ? )
        ORDER BY t.transferred_at DESC`,
        [req.params.id]
      );

      if (rows.length===0){
        
      }

      return res.status(200).json({ data: rows });
    } catch (err) {
      console.error("Fetch transfers error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

// ─── Parcel Documents (Blockchain) ───────────────────────────────────────────

router.get("/:id/documents", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
    "SELECT * FROM parcels WHERE parcel_id=?",
    [req.params.id]
  );
   const titleNumber=rows[0].title_number
    const raw = await evaluateTx("getParcel", titleNumber);
    const parcel = JSON.parse(raw);
    console.log('!!!!!!!!!!!')

    const docs = parcel?.document
      ? [{
          name: "Title Deed",
          docType: parcel.document.type,
          cid: parcel.document.cid,
          date: parcel.registration?.date
        }]
      : [];

    res.json({ data: docs });
    
  } catch (err) {
    console.error("Docs error:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

router.get("/owner/:id", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      "SELECT * FROM parcels WHERE owner_id=?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.json({ message: "Parcels not found" });
    }
    const data= rows.map(row => ({
        parcelID: row.parcel_id,
        titleNumber: row.title_number,
        ownerID: row.owner_id,
        county: row.county,
        subCounty: row.sub_county,
        ward: row.ward,
        status: row.status,
        areaHectares: row.area_hectares,
        landUseType: row.land_use_type,
        gpsCoordinates: row.gps_coordinates,
        blockchainRef: row.blockchain_ref
      })) 
// 
      console.log(data)


    res.json({
      data:data
    });

  } catch (error) {
    console.error("Parcel fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /parcels/:id/search-certificate
router.get("/:id/seach-cetificate", async (req, res) => {
  const { id } = req.params;

  const [[parcel]] = await req.db.execute(
    `SELECT p.*, u.full_name AS owner_name, u.national_id AS owner_national_id
     FROM parcels p JOIN users u ON u.user_id = p.owner_id
     WHERE p.parcel_id = ?`,
    [id]
  );

  if (!parcel) return res.status(404).json({ message: "Parcel not found." });

  const [encumbrances] = await req.db.execute(
    `SELECT * FROM encumbrances WHERE parcel_id = ? AND status = 'ACTIVE'`,
    [id]
  );

  // Return structured certificate data
  // Frontend renders this as a printable PDF
  return res.json({
    certificateNo:   `SRCH-${Date.now()}`,
    issuedAt:        new Date().toISOString(),
    issuedBy:        req.user.fullName,
    parcel,
    encumbrances,
    hasEncumbrances: encumbrances.length > 0,
    blockchainRef:   parcel.blockchain_ref,
    // Blockchain proof: verifiable on-chain
    verificationUrl: `${process.env.APP_URL}/verify?parcel=${id}`,
  });
});

// POST /consents — Registrar logs consent application
router.post("/consents", verifyToken, authorizeRoles("REGISTRAR"), async (req, res) => {
  const { transferId, consentType, scheduledDate } = req.body;

  const consentId = uuidv4();
  await req.db.execute(
    `INSERT INTO consent_requests
       (consent_id, transfer_id, parcel_id, consent_type, scheduled_date)
     SELECT ?, parcel_id, parcel_id, ?, ?
     FROM transfers WHERE transfer_id = ?`,
    [consentId, consentType, scheduledDate, transferId]
  );

  res.status(201).json({ consentId, message: "Consent application recorded." });
});

// PATCH /consents/:id — Record LCB outcome
router.patch("/consents/:id", verifyToken, authorizeRoles("REGISTRAR"), async (req, res) => {
  const { status, grantedBy, refusalReason } = req.body;

  await req.db.execute(
    `UPDATE consent_requests
     SET status = ?, granted_by = ?, refusal_reason = ?, resolved_at = NOW()
     WHERE consent_id = ?`,
    [status, grantedBy, refusalReason, req.params.id]
  );

  // If refused, also reject the transfer
  if (status === "REFUSED") {
    await req.db.execute(
      `UPDATE transfers t
       JOIN consent_requests c ON c.transfer_id = t.transfer_id
       SET t.status = 'REJECTED', t.rejection_reason = ?
       WHERE c.consent_id = ?`,
      [`LCB consent refused: ${refusalReason}`, req.params.id]
    );
  }

  res.json({ message: `Consent ${status.toLowerCase()}.` });
});

export default router;