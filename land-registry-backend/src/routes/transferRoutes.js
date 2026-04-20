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
      [parcelID, req.user.id]
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
        (parcel_id, previous_owner_id, new_owner_id, transfer_type, sale_price, ipfs_cid, blockchain_ref, status, transferred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [parcelID, req.user.id, buyer.user_id, transferType, salePriceKES || 0, ipfsCid || ' ', blockchainRef || ' ']
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
              s.full_name AS prev_owner_name,
              b.full_name AS new_owner_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.parcel_id
       JOIN users s   ON t.previous_owner_id = s.user_id
       JOIN users b   ON t.new_owner_id  = b.user_id
       WHERE t.status = 'PENDING' AND (t.previous_owner_id = ? OR t.new_owner_id = ?)
       ORDER BY t.transferred_at DESC`,
      [req.user.id, req.user.id]
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
              s.full_name AS seller_name,
              b.full_name AS buyer_name
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.parcel_id
       JOIN users s   ON t.previous_owner_id = s.id
       JOIN users b   ON t.new_owner_id  = b.id
       WHERE t.transfer_id = ? AND (t.previous_owner_id = ? OR t.new_owner_id = ?)`,
      [req.params.id, req.user.id, req.user.id]
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


export default router;