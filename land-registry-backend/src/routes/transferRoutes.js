import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/v1/transfers - Initiate a transfer
router.post("/", verifyToken, async (req, res) => {
  const { parcelID, newOwnerID, transferType, salePriceKES, ipfsCid, blockchainRef } = req.body;

  if (!parcelID || !newOwnerID || !transferType) {
    return res.status(400).json({ message: "parcelID, newOwnerID and transferType are required" });
  }

  try {
    // Check parcel exists and belongs to current user
    const [parcels] = await req.db.execute(
      "SELECT * FROM parcels WHERE parcel_id = ? AND owner_id = ?",
      [parcelID, req.user.userId]
    );

    if (!parcels.length) {
      return res.status(404).json({ message: "Parcel not found or you are not the owner" });
    }

    const parcel = parcels[0];
    // Check for pending transfer on the same parcel
    const [transfers] = await req.db.execute(
      "SELECT * FROM transfers WHERE parcel_id = ? AND status = 'PENDING'",
      [parcelID]
    );

    if (transfers.length) {
      return res.status(400).json({ message: "There is already a pending transfer for this parcel" });
    }

    // Check new owner exists
    const [buyers] = await req.db.execute(
      "SELECT * FROM users WHERE national_id = ?",
      [newOwnerID]
    );

    if (!buyers.length) {
      return res.status(404).json({ message: "Buyer not found in the system" });
    }

    const buyer = buyers[0];
   

    // Create transfer record
    const [result] = await req.db.execute(
      `INSERT INTO transfers 
        (parcel_id, previous_owner_id, new_owner_id, transfer_type, sale_price_kes, ipfs_cid, blockchain_ref, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [parcelID, req.user.userId, buyer.user_id, transferType, salePriceKES || 0, ipfsCid || null, blockchainRef || null]
    );
    return res.status(201).json({
      message: "Transfer request initiated successfully",
      data: {
        transferID: result.insertId,
        parcelID,
        newOwnerID: buyer.id,
        transferType,
        status: "PENDING",
      },
    });
  } catch (err) {
    console.error("Transfer initiation error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/v1/transfers - Get all transfers for current user
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT t.*, p.title_number, p.county,
              s.first_name AS prev_owner_first_name, s.last_name AS prev_owner_last_name,
              b.first_name AS new_owner_first_name, b.last_name AS new_owner_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.parcel_id
       JOIN users s   ON t.previous_owner_id = s.user_id
       JOIN users b   ON t.new_owner_id  = b.user_id
       WHERE t.status = 'PENDING' AND (t.previous_owner_id = ? OR t.new_owner_id = ?)
       ORDER BY t.transferred_at DESC`,
      [req.user.userId, req.user.userId]
    );

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error("Fetch transfers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/v1/transfers/:id - Get single transfer
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT t.*, p.title_number, p.county,
              s.first_name AS seller_first_name, s.last_name AS seller_last_name,
              b.first_name AS buyer_first_name, b.last_name AS buyer_last_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.parcel_id
       JOIN users s   ON t.previous_owner_id = s.user_id
       JOIN users b   ON t.new_owner_id  = b.useid
       WHERE t.transfer_id = ? AND (t.previous_owner_id = ? OR t.new_owner_id = ?)`,
      [req.params.id, req.user.userId, req.user.userId]
    );


    if (!rows.length) {
      return res.status(404).json({ message: "Transfer not found" });
    } 

    return res.status(200).json({ data: rows[0] });
  } catch (err) {
    console.error("Fetch transfer error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// post /api/v1/transfers/:id/status - Approve or reject (registrar only)
router.post("/:id/approve", verifyToken, async (req, res) => {
  try {
    // 🔍 Get transfer
    const [rows] = await req.db.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    const transfer = rows[0];

    if (transfer.status !== "PENDING") {
      return res.status(400).json({ message: "Transfer already processed" });
    }

  
  // Document gate — nothing moves without these
  const missing = [];
  if (!transfer.stamp_duty_receipt)   missing.push("Stamp duty receipt");
  if (!transfer.valuation_certificate) missing.push("Valuation certificate");

  // Check consent was granted for agricultural land
  const [[parcel]] = await req.db.execute(
    `SELECT land_use_type FROM parcels WHERE parcel_id = ?`, [transfer.parcel_id]
  );

  if (parcel.land_use_type === "AGRICULTURAL") {
    const [[consent]] = await req.db.execute(
      `SELECT status FROM consent_requests
       WHERE transfer_id = ? AND consent_type = 'LCB'
       ORDER BY created_at DESC LIMIT 1`,
      [transfer.transfer_id]
    );
    if (!consent || consent.status !== "GRANTED") {
      missing.push("LCB consent");
    }
  }

  if (missing.length > 0) {
    return res.status(422).json({
      message: "Cannot approve — missing required documents.",
      missing,
    });
  }

    // ✅ Update transfer
    await req.db.execute(
      "UPDATE transfers SET status = 'APPROVED' WHERE transfer_id = ?",
      [req.params.id]
    );

    // 🏠 Transfer ownership
    await req.db.execute(
      "UPDATE parcels SET owner_id = ? WHERE parcel_id = ?",
      [transfer.new_owner_id, transfer.parcel_id]
    );

    // 🔒 Transfer encumbrances
    // await req.db.execute(
    //   `UPDATE encumbrances 
    //    SET owner_id = ? 
    //    WHERE parcel_id = ? AND status = 'ACTIVE'`,
    //   [transfer.new_owner_id, transfer.parcel_id]
    // );

    // 🔔 Notify new owner
    await req.db.execute(
      `INSERT INTO notifications (user_id, type, message)
       VALUES (?, 'success', ?)`,
      [
        transfer.new_owner_id,
        `Transfer #${transfer.transfer_id} approved`
      ]
    );

    return res.json({ message: "Transfer approved successfully" });

  } catch (err) {
    console.error("Approve error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/reject", verifyToken, async (req, res) => {
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      message: "Rejection reason is required"
    });
  }

  try {
    const [rows] = await req.db.execute(
      "SELECT * FROM transfers WHERE transfer_id = ?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    const transfer = rows[0];

    if (transfer.status !== "PENDING") {
      return res.status(400).json({ message: "Transfer already processed" });
    }

    // ❌ Update transfer
    await req.db.execute(
      "UPDATE transfers SET status = 'REJECTED', reason = ? WHERE transfer_id = ?",
      [reason, req.params.id]
    );

    // 🔔 Notify previous owner
    await req.db.execute(
      `INSERT INTO notifications (user_id, type, message)
       VALUES (?, 'warn', ?)`,
      [
        transfer.previous_owner_id,
        `Transfer #${transfer.transfer_id} rejected: ${reason}`
      ]
    );

    return res.json({ message: "Transfer rejected successfully" });

  } catch (err) {
    console.error("Reject error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// post /transfers/:id/valuation — Registrar records valuation outcome
router.post("/transfers/:id/valuation", verifyToken, authorizeRoles("REGISTRAR"), async (req, res) => {
  const { valuationKES, stampDutyKES, stampDutyReceipt, valuationCertCID } = req.body;

  // Calculate expected stamp duty (4% urban, 2% rural)
  const [[parcel]] = await req.db.execute(
    `SELECT p.county FROM transfers t JOIN parcels p ON p.parcel_id = t.parcel_id
     WHERE t.transfer_id = ?`, [req.params.id]
  );

  const URBAN_COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret"];
  const rate      = URBAN_COUNTIES.includes(parcel.county) ? 0.04 : 0.02;
  const expected  = Math.round(valuationKES * rate);

  if (stampDutyKES < expected) {
    return res.status(422).json({
      message: `Stamp duty KES ${stampDutyKES.toLocaleString()} is below the required KES ${expected.toLocaleString()} (${rate * 100}% of KES ${valuationKES.toLocaleString()}).`,
    });
  }

  await req.db.execute(
    `UPDATE transfers
     SET valuation_kes = ?, stamp_duty_kes = ?,
         stamp_duty_receipt = ?, valuation_certificate = ?
     WHERE transfer_id = ?`,
    [valuationKES, stampDutyKES, stampDutyReceipt, valuationCertCID, req.params.id]
  );

  res.json({ message: "Valuation and stamp duty recorded." });
});


export default router;
