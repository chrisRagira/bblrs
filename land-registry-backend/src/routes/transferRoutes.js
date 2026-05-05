import express                            from "express";
import multer                             from "multer";
import crypto                             from "crypto";
import { verifyToken, authorizeRoles }    from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function computeHash(buffer) {
  return "sha256-" + crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Atomically move a transfer from one status to another and log the event.
 * Throws if the row was already moved by a concurrent request.
 */
async function transition(conn, { transferId, actorId, actorRole, from, to, notes = null }) {
  const [upd] = await conn.execute(
    "UPDATE transfers SET status = ? WHERE transfer_id = ? AND status = ?",
    [to, transferId, from]
  );
  if (!upd.affectedRows) {
    throw Object.assign(new Error("Status conflict"), { statusCode: 409 });
  }
  await conn.execute(
    `INSERT INTO transfer_events
       (transfer_id, actor_id, actor_role, from_status, to_status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [transferId, actorId, actorRole, from, to, notes]
  );
}

async function notify(db, userId, type, message) {
  await db.execute(
    "INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)",
    [userId, type, message]
  );
}

// Save one or more uploaded files to transfer_documents and return the primary CID
async function saveDocs(conn, transferId, files, slots) {
  let primaryCid = null;
  for (const slot of slots) {
    const file = files?.[slot]?.[0];
    if (!file) continue;
    const hash = computeHash(file.buffer);
    if (!primaryCid) primaryCid = hash;
    await conn.execute(
      `INSERT INTO transfer_documents
         (transfer_id, document_role, original_filename, mime_type,
          size_bytes, ipfs_cid, file_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [transferId, slot, file.originalname, file.mimetype, file.size, hash, file.buffer]
    );
  }
  return primaryCid;
}


// ─────────────────────────────────────────────
// Stage 1 — Seller initiates transfer
// POST /api/v1/transfers
// ─────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  const { parcelID, newOwnerID, transferType, salePriceKES, advocateNationalId } = req.body;

  if (!parcelID || !newOwnerID || !transferType || !advocateNationalId) {
    return res.status(400).json({
      message: "parcelID, newOwnerID, transferType and advocateNationalId are required",
    });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    // Parcel must exist and belong to the caller
    const [[parcel]] = await conn.execute(
      "SELECT * FROM parcels WHERE parcel_id = ? AND owner_id = ?",
      [parcelID, req.user.userId]
    );
    if (!parcel) {
      await conn.rollback();
      return res.status(404).json({ message: "Parcel not found or you are not the owner" });
    }

    // No duplicate active transfers
    const [active] = await conn.execute(
      `SELECT transfer_id FROM transfers
       WHERE parcel_id = ? AND status NOT IN ('APPROVED','REJECTED','CANCELLED','BUYER_REJECTED')`,
      [parcelID]
    );
    if (active.length) {
      await conn.rollback();
      return res.status(400).json({ message: "An active transfer already exists for this parcel" });
    }

    // Buyer must be a registered user
    const [[buyer]] = await conn.execute(
      "SELECT user_id FROM users WHERE national_id = ?",
      [newOwnerID]
    );
    if (!buyer) {
      await conn.rollback();
      return res.status(404).json({ message: "Buyer not found in the system" });
    }

    // Advocate must be a registered advocate
    const [[advocate]] = await conn.execute(
      "SELECT user_id FROM users WHERE national_id = ? AND role = 'ADVOCATE'",
      [advocateNationalId]
    );
    if (!advocate) {
      await conn.rollback();
      return res.status(404).json({ message: "Advocate not found in the system" });
    }

    const [result] = await conn.execute(
      `INSERT INTO transfers
         (parcel_id, previous_owner_id, new_owner_id, advocate_id,
          transfer_type, sale_price, status, transferred_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_BUYER_APPROVAL', NOW())`,
      [parcelID, req.user.userId, buyer.user_id, advocate.user_id, transferType, salePriceKES || 0]
    );
    const transferId = result.insertId;

    await conn.execute(
      `INSERT INTO transfer_events
         (transfer_id, actor_id, actor_role, from_status, to_status, notes)
       VALUES (?, ?, 'SELLER', 'NONE', 'PENDING_BUYER_APPROVAL', 'Transfer initiated')`,
      [transferId, req.user.userId]
    );

    // Notify buyer
    await notify(conn, buyer.user_id, "info",
      `You have a pending land transfer #${transferId} awaiting your approval.`);

    await conn.commit();
    return res.status(201).json({
      message: "Transfer initiated. Awaiting buyer approval.",
      data: { transferID: transferId, status: "PENDING_BUYER_APPROVAL" },
    });
  } catch (err) {
    await conn.rollback();
    console.error("Transfer initiation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 2 — Buyer approves or rejects
// PATCH /api/v1/transfers/:id/buyer-decision
// ─────────────────────────────────────────────
router.post("/:id/buyer-decision", verifyToken, async (req, res) => {
  const { decision, notes } = req.body; // "APPROVE" | "REJECT"
  if (!["APPROVE", "REJECT"].includes(decision)) {
    return res.status(400).json({ message: "decision must be APPROVE or REJECT" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?",
      [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }
    if (transfer.new_owner_id !== req.user.userId) {
      await conn.rollback();
      return res.status(403).json({ message: "Only the buyer can action this step" });
    }

    const toStatus = decision === "APPROVE" ? "PENDING_ADVOCATE_DOCS" : "BUYER_REJECTED";
    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "BUYER",
      from:       "PENDING_BUYER_APPROVAL",
      to:         toStatus,
      notes,
    });

    if (decision === "APPROVE") {
      // Notify advocate
      await notify(conn, transfer.advocate_id, "info",
        `You have been appointed as advocate for transfer #${transfer.transfer_id}. Please prepare and upload the legal documents.`);
    } else {
      // Notify seller
      await notify(conn, transfer.previous_owner_id, "warn",
        `Transfer #${transfer.transfer_id} was rejected by the buyer.`);
    }

    await conn.commit();
    return res.json({ message: `Transfer ${decision === "APPROVE" ? "approved by buyer" : "rejected by buyer"}.` });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("Buyer decision error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 3 — Advocate uploads legal documents
// PATCH /api/v1/transfers/:id/advocate-docs
// ─────────────────────────────────────────────
router.post(
  "/:id/advocate-docs",
  verifyToken,
  authorizeRoles("ADVOCATE"),
  upload.fields([
    { name: "agreement",      maxCount: 1 },
    { name: "consideration",  maxCount: 1 },
    { name: "supporting",     maxCount: 1 },
  ]),
  async (req, res) => {
    if (!req.files?.agreement?.[0]) {
      return res.status(400).json({ message: "Transfer/sale agreement is required" });
    }

    const conn = await req.db.getConnection();
    try {
      await conn.beginTransaction();

      const [[transfer]] = await conn.execute(
        "SELECT * FROM transfers WHERE transfer_id = ?",
        [req.params.id]
      );
      if (!transfer) {
        await conn.rollback();
        return res.status(404).json({ message: "Transfer not found" });
      }
      if (transfer.advocate_id !== req.user.userId) {
        await conn.rollback();
        return res.status(403).json({ message: "You are not the appointed advocate for this transfer" });
      }

      const primaryCid = await saveDocs(conn, transfer.transfer_id, req.files,
        ["agreement", "consideration", "supporting"]);

      await conn.execute(
        "UPDATE transfers SET ipfs_cid = ? WHERE transfer_id = ?",
        [primaryCid, transfer.transfer_id]
      );

      await transition(conn, {
        transferId: transfer.transfer_id,
        actorId:    req.user.userId,
        actorRole:  "ADVOCATE",
        from:       "PENDING_ADVOCATE_DOCS",
        to:         "PENDING_CLERK_VERIFICATION",
        notes:      req.body.notes || null,
      });

      // Notify clerk(s) — broadcast to role
      const [clerks] = await conn.execute(
        "SELECT user_id FROM users WHERE role = 'CLERK'"
      );
      for (const clerk of clerks) {
        await notify(conn, clerk.user_id, "info",
          `Transfer #${transfer.transfer_id} is ready for document verification.`);
      }

      await conn.commit();
      return res.json({ message: "Documents uploaded. Transfer forwarded to registry clerk." });
    } catch (err) {
      await conn.rollback();
      if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
      console.error("Advocate docs error:", err);
      return res.status(500).json({ message: "Internal server error" });
    } finally {
      conn.release();
    }
  }
);


// ─────────────────────────────────────────────
// Stage 4 — Registry clerk verifies documents
// PATCH /api/v1/transfers/:id/clerk-verify
// ─────────────────────────────────────────────
router.post("/:id/clerk-verify", verifyToken, authorizeRoles("CLERK"), async (req, res) => {
  // decision: "APPROVE" | "REJECT" | "REQUIRE_SURVEY"
  const { decision, surveyorNationalId, notes } = req.body;
  if (!["APPROVE", "REJECT", "REQUIRE_SURVEY"].includes(decision)) {
    return res.status(400).json({ message: "decision must be APPROVE, REJECT, or REQUIRE_SURVEY" });
  }
  if (decision === "REQUIRE_SURVEY" && !surveyorNationalId) {
    return res.status(400).json({ message: "surveyorNationalId is required when requiring a survey" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT t.*, p.land_use_type FROM transfers t JOIN parcels p ON p.parcel_id = t.parcel_id WHERE t.transfer_id = ?",
      [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }

    let toStatus;
    if (decision === "REJECT") {
      toStatus = "REJECTED";
    } else if (decision === "REQUIRE_SURVEY") {
      const [[surveyor]] = await conn.execute(
        "SELECT user_id FROM users WHERE national_id = ? AND role = 'SURVEYOR'",
        [surveyorNationalId]
      );
      if (!surveyor) {
        await conn.rollback();
        return res.status(404).json({ message: "Surveyor not found" });
      }
      await conn.execute(
        "UPDATE transfers SET surveyor_id = ? WHERE transfer_id = ?",
        [surveyor.user_id, transfer.transfer_id]
      );
      await notify(conn, surveyor.user_id, "info",
        `You have been appointed as surveyor for transfer #${transfer.transfer_id}.`);
      toStatus = "PENDING_SURVEY";
    } else {
      // APPROVE — decide next gate
      toStatus = transfer.land_use_type === "AGRICULTURAL"
        ? "PENDING_LCB_APPROVAL"
        : "PENDING_COUNTY_RATES";
      await notifyNextStage(conn, transfer, toStatus);
    }

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "CLERK",
      from:       "PENDING_CLERK_VERIFICATION",
      to:         toStatus,
      notes,
    });

    if (decision === "REJECT") {
      await notify(conn, transfer.previous_owner_id, "danger",
        `Transfer #${transfer.transfer_id} was rejected at document verification. Reason: ${notes || "none"}`);
    }

    await conn.commit();
    return res.json({ message: `Clerk decision recorded. Status: ${toStatus}` });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("Clerk verify error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 5 — Surveyor submits findings
// PATCH /api/v1/transfers/:id/survey
// ─────────────────────────────────────────────
router.post("/:id/survey", verifyToken, authorizeRoles("SURVEYOR"), async (req, res) => {
  const { notes, coordinateAdjustments } = req.body;

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT t.*, p.land_use_type FROM transfers t JOIN parcels p ON p.parcel_id = t.parcel_id WHERE t.transfer_id = ?",
      [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }
    if (transfer.surveyor_id !== req.user.userId) {
      await conn.rollback();
      return res.status(403).json({ message: "You are not the appointed surveyor for this transfer" });
    }

    // Apply coordinate adjustments to parcel if provided
    if (coordinateAdjustments) {
      await conn.execute(
        "UPDATE parcels SET coordinates = ? WHERE parcel_id = ?",
        [JSON.stringify(coordinateAdjustments), transfer.parcel_id]
      );
    }

    const toStatus = transfer.land_use_type === "AGRICULTURAL"
      ? "PENDING_LCB_APPROVAL"
      : "PENDING_COUNTY_RATES";

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "SURVEYOR",
      from:       "PENDING_SURVEY",
      to:         toStatus,
      notes,
    });

    await notifyNextStage(conn, transfer, toStatus);

    await conn.commit();
    return res.json({ message: `Survey submitted. Status: ${toStatus}` });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("Survey error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 6 — LCB approval (agricultural only)
// PATCH /api/v1/transfers/:id/lcb-decision
// ─────────────────────────────────────────────
router.post("/:id/lcb-decision", verifyToken, authorizeRoles("LAND_CONTROL_BOARD"), async (req, res) => {
  const { decision, notes } = req.body;
  if (!["APPROVE", "REJECT"].includes(decision)) {
    return res.status(400).json({ message: "decision must be APPROVE or REJECT" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?", [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }

    const toStatus = decision === "APPROVE" ? "PENDING_COUNTY_RATES" : "REJECTED";

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "LCB_OFFICER",
      from:       "PENDING_LCB_APPROVAL",
      to:         toStatus,
      notes,
    });

    if (decision === "APPROVE") {
      await notifyNextStage(conn, transfer, toStatus);
    } else {
      await notify(conn, transfer.previous_owner_id, "danger",
        `Transfer #${transfer.transfer_id} was rejected by the Land Control Board. Reason: ${notes || "none"}`);
    }

    await conn.commit();
    return res.json({ message: `LCB decision recorded. Status: ${toStatus}` });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("LCB decision error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 7 — County officer confirms rates cleared
// PATCH /api/v1/transfers/:id/county-rates
// ─────────────────────────────────────────────
router.post("/:id/county-rates", verifyToken, authorizeRoles("COUNTY_OFFICER"), async (req, res) => {
  const { ratesCleared, notes } = req.body;
  if (typeof ratesCleared !== "boolean") {
    return res.status(400).json({ message: "ratesCleared (boolean) is required" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?", [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }

    if (!ratesCleared) {
      await transition(conn, {
        transferId: transfer.transfer_id,
        actorId:    req.user.userId,
        actorRole:  "COUNTY_OFFICER",
        from:       "PENDING_COUNTY_RATES",
        to:         "REJECTED",
        notes:      notes || "Outstanding land rates",
      });
      await notify(conn, transfer.previous_owner_id, "danger",
        `Transfer #${transfer.transfer_id} blocked — outstanding land rates must be cleared.`);
      await conn.commit();
      return res.json({ message: "Transfer blocked. Seller notified to clear rates." });
    }

    await conn.execute(
      "UPDATE transfers SET county_officer_id = ? WHERE transfer_id = ?",
      [req.user.userId, transfer.transfer_id]
    );

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "COUNTY_OFFICER",
      from:       "PENDING_COUNTY_RATES",
      to:         "PENDING_VALUATION",
      notes,
    });

    // Notify valuers
    const [valuers] = await conn.execute("SELECT user_id FROM users WHERE role = 'VALUER'");
    for (const v of valuers) {
      await notify(conn, v.user_id, "info",
        `Transfer #${transfer.transfer_id} is ready for land valuation.`);
    }

    await conn.commit();
    return res.json({ message: "Rates confirmed cleared. Transfer forwarded for valuation." });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("County rates error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 8 — Government valuer sets stamp duty
// PATCH /api/v1/transfers/:id/valuation
// ─────────────────────────────────────────────
router.post("/:id/valuation", verifyToken, authorizeRoles("VALUER"), async (req, res) => {
  const { valuationKES, notes } = req.body;
  if (!valuationKES || isNaN(valuationKES)) {
    return res.status(400).json({ message: "valuationKES is required" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      `SELECT t.*, p.county FROM transfers t
       JOIN parcels p ON p.parcel_id = t.parcel_id
       WHERE t.transfer_id = ?`,
      [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }

    // 4% urban, 2% rural
    const URBAN_COUNTIES = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"];
    const rate       = URBAN_COUNTIES.includes(transfer.county) ? 0.04 : 0.02;
    const stampDuty  = Math.round(valuationKES * rate);

    await conn.execute(
      `UPDATE transfers
       SET valuer_id = ?, valuation_kes = ?, stamp_duty_kes = ?
       WHERE transfer_id = ?`,
      [req.user.userId, valuationKES, stampDuty, transfer.transfer_id]
    );

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "VALUER",
      from:       "PENDING_VALUATION",
      to:         "PENDING_STAMP_DUTY",
      notes,
    });

    // Notify buyer with stamp duty amount
    await notify(conn, transfer.new_owner_id, "info",
      `Transfer #${transfer.transfer_id} has been valued at KES ${Number(valuationKES).toLocaleString()}. ` +
      `Stamp duty of KES ${stampDuty.toLocaleString()} (${rate * 100}%) is due. Please upload proof of payment.`
    );

    await conn.commit();
    return res.json({
      message: "Valuation recorded. Buyer notified of stamp duty.",
      data: { valuationKES, stampDutyKES: stampDuty, rate },
    });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("Valuation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Stage 9 — Buyer uploads stamp duty proof
// PATCH /api/v1/transfers/:id/stamp-duty
// ─────────────────────────────────────────────
router.post(
  "/:id/stamp-duty",
  verifyToken,
  upload.single("paymentProof"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "paymentProof document is required" });
    }

    const conn = await req.db.getConnection();
    try {
      await conn.beginTransaction();

      const [[transfer]] = await conn.execute(
        "SELECT * FROM transfers WHERE transfer_id = ?", [req.params.id]
      );
      if (!transfer) {
        await conn.rollback();
        return res.status(404).json({ message: "Transfer not found" });
      }
      if (transfer.new_owner_id !== req.user.userId) {
        await conn.rollback();
        return res.status(403).json({ message: "Only the buyer can upload stamp duty proof" });
      }

      const hash = computeHash(req.file.buffer);
      await conn.execute(
        `INSERT INTO transfer_documents
           (transfer_id, document_role, original_filename, mime_type,
            size_bytes, ipfs_cid, file_data, created_at)
         VALUES (?, 'stamp_duty_proof', ?, ?, ?, ?, ?, NOW())`,
        [transfer.transfer_id, req.file.originalname, req.file.mimetype,
         req.file.size, hash, req.file.buffer]
      );

      await conn.execute(
        "UPDATE transfers SET stamp_duty_paid = TRUE, stamp_duty_receipt = ? WHERE transfer_id = ?",
        [hash, transfer.transfer_id]
      );

      await transition(conn, {
        transferId: transfer.transfer_id,
        actorId:    req.user.userId,
        actorRole:  "BUYER",
        from:       "PENDING_STAMP_DUTY",
        to:         "PENDING_REGISTRAR_APPROVAL",
        notes:      req.body.notes || null,
      });

      // Notify registrars
      const [registrars] = await conn.execute("SELECT user_id FROM users WHERE role = 'REGISTRAR'");
      for (const r of registrars) {
        await notify(conn, r.user_id, "info",
          `Transfer #${transfer.transfer_id} is ready for final registrar approval.`);
      }

      await conn.commit();
      return res.json({ message: "Stamp duty proof uploaded. Transfer forwarded to Registrar." });
    } catch (err) {
      await conn.rollback();
      if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
      console.error("Stamp duty error:", err);
      return res.status(500).json({ message: "Internal server error" });
    } finally {
      conn.release();
    }
  }
);


// ─────────────────────────────────────────────
// Stage 10 — Registrar final approval
// POST /api/v1/transfers/:id/approve  (kept as POST for backward compat)
// ─────────────────────────────────────────────
router.post("/:id/approve", verifyToken, authorizeRoles("REGISTRAR"), async (req, res) => {
  const { notes } = req.body;

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?", [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }
    if (transfer.status !== "PENDING_REGISTRAR_APPROVAL") {
      await conn.rollback();
      return res.status(400).json({
        message: `Transfer cannot be approved at status: ${transfer.status}`,
      });
    }

    // Document gate
    const missing = [];
    if (!transfer.stamp_duty_receipt)    missing.push("Stamp duty receipt");
    if (!transfer.valuation_kes)         missing.push("Valuation");

    // LCB gate for agricultural parcels
    const [[parcel]] = await conn.execute(
      "SELECT land_use_type FROM parcels WHERE parcel_id = ?", [transfer.parcel_id]
    );
    if (parcel.land_use_type === "AGRICULTURAL") {
      const [[lcbEvent]] = await conn.execute(
        `SELECT event_id FROM transfer_events
         WHERE transfer_id = ? AND actor_role = 'LCB_OFFICER' AND to_status = 'PENDING_COUNTY_RATES'
         LIMIT 1`,
        [transfer.transfer_id]
      );
      if (!lcbEvent) missing.push("LCB approval");
    }

    if (missing.length) {
      await conn.rollback();
      return res.status(422).json({
        message: "Cannot approve — missing required steps.",
        missing,
      });
    }

    await transition(conn, {
      transferId: transfer.transfer_id,
      actorId:    req.user.userId,
      actorRole:  "REGISTRAR",
      from:       "PENDING_REGISTRAR_APPROVAL",
      to:         "APPROVED",
      notes,
    });

    // Transfer parcel ownership
    await conn.execute(
      "UPDATE parcels SET owner_id = ? WHERE parcel_id = ?",
      [transfer.new_owner_id, transfer.parcel_id]
    );

    // Reassign active encumbrances to new owner
    // await conn.execute(
    //   `UPDATE encumbrances SET owner_id = ?
    //    WHERE parcel_id = ? AND status = 'ACTIVE'`,
    //   [transfer.new_owner_id, transfer.parcel_id]
    // );

    // Stage 11: create title record
    await conn.execute(
      `INSERT INTO titles
         (transfer_id, parcel_id, owner_id, issued_at, title_ref)
       VALUES (?, ?, ?, NOW(), ?)`,
      [
        transfer.transfer_id,
        transfer.parcel_id,
        transfer.new_owner_id,
        `TITLE-${transfer.parcel_id}-${Date.now()}`,
      ]
    );

    await notify(conn, transfer.new_owner_id, "success",
      `Congratulations! Transfer #${transfer.transfer_id} has been approved. Your title deed has been issued.`);
    await notify(conn, transfer.previous_owner_id, "info",
      `Transfer #${transfer.transfer_id} has been completed. Ownership has been transferred.`);

    await conn.commit();
    return res.json({ message: "Transfer approved. Title deed issued." });
  } catch (err) {
    await conn.rollback();
    if (err.statusCode === 409) return res.status(409).json({ message: "Concurrent status change — please retry" });
    console.error("Approve error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// Registrar rejection (any active stage)
// POST /api/v1/transfers/:id/reject
// ─────────────────────────────────────────────
router.post("/:id/reject", verifyToken, authorizeRoles("REGISTRAR"), async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) {
    return res.status(400).json({ message: "Rejection reason is required" });
  }

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [[transfer]] = await conn.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?", [req.params.id]
    );
    if (!transfer) {
      await conn.rollback();
      return res.status(404).json({ message: "Transfer not found" });
    }

    const terminalStatuses = ["APPROVED", "REJECTED", "CANCELLED", "BUYER_REJECTED"];
    if (terminalStatuses.includes(transfer.status)) {
      await conn.rollback();
      return res.status(400).json({ message: "Transfer is already in a terminal state" });
    }

    await conn.execute(
      "UPDATE transfers SET status = 'REJECTED', reason = ? WHERE transfer_id = ?",
      [reason, transfer.transfer_id]
    );
    await conn.execute(
      `INSERT INTO transfer_events
         (transfer_id, actor_id, actor_role, from_status, to_status, notes)
       VALUES (?, ?, 'REGISTRAR', ?, 'REJECTED', ?)`,
      [transfer.transfer_id, req.user.userId, transfer.status, reason]
    );

    await notify(conn, transfer.previous_owner_id, "danger",
      `Transfer #${transfer.transfer_id} was rejected by the Registrar. Reason: ${reason}`);

    await conn.commit();
    return res.json({ message: "Transfer rejected." });
  } catch (err) {
    await conn.rollback();
    console.error("Reject error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});


// ─────────────────────────────────────────────
// GET /api/v1/transfers — list transfers for current user
// ─────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT t.transfer_id, t.status, t.transfer_type, t.sale_price,
              t.transferred_at, t.stamp_duty_kes,
              p.title_number, p.county, p.area_hectares,
              s.first_name AS seller_first_name, s.last_name AS seller_last_name,
              b.first_name AS buyer_first_name,  b.last_name AS buyer_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id   = p.parcel_id
       JOIN users   s ON t.previous_owner_id = s.user_id
       JOIN users   b ON t.new_owner_id      = b.user_id
       WHERE t.previous_owner_id = ? OR t.new_owner_id = ? OR t.advocate_id = ?
       ORDER BY t.transferred_at DESC`,
      [req.user.userId, req.user.userId, req.user.userId]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("Fetch transfers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/surveyor/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT t.transfer_id, t.status, t.transfer_type, t.sale_price,
              t.transferred_at, t.stamp_duty_kes,
              p.title_number, p.county, p.area_hectares,
              s.first_name AS seller_first_name, s.last_name AS seller_last_name,
              b.first_name AS buyer_first_name,  b.last_name AS buyer_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id   = p.parcel_id
       JOIN users   s ON t.previous_owner_id = s.user_id
       JOIN users   b ON t.new_owner_id      = b.user_id
       WHERE t.surveyor_id = ? 
       ORDER BY t.transferred_at DESC`,
      [req.params.id]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("Fetch transfers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/v1/transfers/pending — queue for registrar / clerks
// ─────────────────────────────────────────────
router.get("/pending", verifyToken, async (req, res) => {
  const role = req.user.role;
  const statusFilter = role === "REGISTRAR"
    ? "PENDING_REGISTRAR_APPROVAL"
    : "PENDING_CLERK_VERIFICATION";

  try {
    const [rows] = await req.db.execute(
      `SELECT t.transfer_id, t.status, t.transfer_type, t.sale_price, t.transferred_at,
              p.title_number, p.county,
              s.first_name AS seller_first_name, s.last_name AS seller_last_name,
              b.first_name AS buyer_first_name,  b.last_name AS buyer_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id         = p.parcel_id
       JOIN users   s ON t.previous_owner_id = s.user_id
       JOIN users   b ON t.new_owner_id      = b.user_id
       WHERE t.status = ?
       ORDER BY t.transferred_at ASC`,
      [statusFilter]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("Fetch pending error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});



router.get("/lcb", verifyToken, async (req, res) => {
  
  try {
    const [rows] = await req.db.execute(
      `SELECT 
          t.transfer_id, 
          t.status, 
          t.transfer_type, 
          t.sale_price, 
          t.transferred_at,
          p.title_number, 
          p.county,
          s.first_name AS seller_first_name, 
          s.last_name  AS seller_last_name,
          b.first_name AS buyer_first_name,  
          b.last_name  AS buyer_last_name
      FROM transfers t
      JOIN parcels p ON t.parcel_id         = p.parcel_id
      JOIN users   s ON t.previous_owner_id = s.user_id
      JOIN users   b ON t.new_owner_id      = b.user_id
      WHERE t.status <> ?
        AND LOWER(p.land_use_type) = 'agricultural'
      ORDER BY t.transferred_at ASC`,
      ['APPROVED']
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("Fetch pending error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// ─────────────────────────────────────────────
// GET /api/v1/transfers/:id — single transfer detail
// ─────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const [[transfer]] = await req.db.execute(
      `SELECT t.*, p.title_number, p.county, p.area_hectares, p.land_use_type,
              s.first_name AS seller_first_name, s.last_name AS seller_last_name,
              b.first_name AS buyer_first_name,  b.last_name AS buyer_last_name,
              a.first_name AS advocate_first_name, a.last_name AS advocate_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id         = p.parcel_id
       JOIN users   s ON t.previous_owner_id = s.user_id
       JOIN users   b ON t.new_owner_id      = b.user_id
       LEFT JOIN users a ON t.advocate_id   = a.user_id
       WHERE t.transfer_id = ?
         AND (t.previous_owner_id = ? OR t.new_owner_id = ?
              OR t.advocate_id = ? OR ? IN (
                SELECT user_id FROM users WHERE role IN ('REGISTRAR','CLERK','SURVEYOR','LCB_OFFICER','COUNTY_OFFICER','VALUER','LAND_CONTROL_BOARD')
              ))`,
      [req.params.id, req.user.userId, req.user.userId, req.user.userId, req.user.userId]
    );
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });

    // Attach event log
    const [events] = await req.db.execute(
      `SELECT te.*, u.first_name, u.last_name
       FROM transfer_events te
       JOIN users u ON te.actor_id = u.user_id
       WHERE te.transfer_id = ?
       ORDER BY te.created_at ASC`,
      [req.params.id]
    );

    return res.json({ data: { ...transfer, events } });
  } catch (err) {
    console.error("Fetch transfer error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// ─────────────────────────────────────────────
// GET /api/v1/transfers/:id/title — issued title
// ─────────────────────────────────────────────
router.get("/:id/title", verifyToken, async (req, res) => {
  try {
    const [[title]] = await req.db.execute(
      `SELECT ti.*, p.title_number, p.county, p.area_hectares,
              u.first_name, u.last_name, u.national_id
       FROM titles ti
       JOIN parcels p ON ti.parcel_id = p.parcel_id
       JOIN users   u ON ti.owner_id  = u.user_id
       WHERE ti.transfer_id = ?`,
      [req.params.id]
    );
    if (!title) return res.status(404).json({ message: "Title not yet issued for this transfer" });
    return res.json({ data: title });
  } catch (err) {
    console.error("Title fetch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// ─────────────────────────────────────────────
// Internal helper — notify the right people for each status
// ─────────────────────────────────────────────
async function notifyNextStage(conn, transfer, toStatus) {
  const roleMap = {
    PENDING_LCB_APPROVAL:          "LCB_OFFICER",
    PENDING_COUNTY_RATES:          "COUNTY_OFFICER",
    PENDING_VALUATION:             "VALUER",
    PENDING_REGISTRAR_APPROVAL:    "REGISTRAR",
  };
  const role = roleMap[toStatus];
  if (!role) return;
  const [users] = await conn.execute("SELECT user_id FROM users WHERE role = ?", [role]);
  for (const u of users) {
    await notify(conn, u.user_id, "info",
      `Transfer #${transfer.transfer_id} requires your action (${role.replace(/_/g, " ")}).`);
  }
}


export default router;