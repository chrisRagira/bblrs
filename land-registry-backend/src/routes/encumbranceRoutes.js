import express from "express";
import { submitEncumbranceTx, evaluateEncumbranceTx } from "../fabric.js";

const router = express.Router();



router.get("/all", async (req, res) => {
  try {
    let { page = 1, limit = 10, status, parcelID } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const  result  = await evaluateEncumbranceTx("getAllEncumbrances");
    // console.log(`Fetched encumbrances: ${result}`);
    let data = JSON.parse(result);

    // 🔍 FILTERS
    if (status) {
      data = data.filter(e => e.status === status.toUpperCase());
    }

    if (parcelID) {
      data = data.filter(e => e.parcelID === parcelID);
    }

    // 📄 PAGINATION
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedData = data.slice(start, end);

    res.json({
      total: data.length,
      page,
      limit,
      totalPages: Math.ceil(data.length / limit),
      data: paginatedData
    });

  } catch (err) {
    console.error("Fetch encumbrances error:", err);
    res.status(500).json({ message: "Failed to fetch encumbrances" });
  }
});

// ─── Register Encumbrance ─────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const {
      parcelID,
      encumbranceType,
      creditorName,
      creditorID,
      amountKES,
      registrationDate,
      expiryDate
    } = req.body;

    // Generate encumbranceID (or use UUID)
    const encumbranceID = `ENC-${Date.now()}`;

    const { txId, result } = await submitEncumbranceTx(
      "registerEncumbrance",
      encumbranceID,
      parcelID,
      encumbranceType,
      creditorName,
      creditorID,
      amountKES.toString(),
      registrationDate,
      expiryDate
    );
    const [user] = await req.db.execute(
      "SELECT owner_id FROM parcels WHERE title_number = ?",
      [parcelID]
    );
    const ownerId = user[0].owner_id;
    await req.db.execute(
      `INSERT INTO notifications (user_id, type, message)
      VALUES (?, 'warn', ?)`,
      [
        ownerId,
        `Encumbrance #${encumbranceID} has been charged to parcel ${parcelID}
        in favor of ${creditorName} for KES ${amountKES} on ${registrationDate}.`
      ]
    );

    res.json({
      txId,
      data: JSON.parse(result)
    });

  } catch (err) {
    console.error("Register encumbrance error:", err);
    res.status(500).json({ message: "Failed to register encumbrance" });
  }
});

// ─── Get All Encumbrances for a Parcel ───────────────────────────────────────

router.get("/:parcelId", async (req, res) => {
  try {
    const raw = await evaluateEncumbranceTx("getEncumbrancesByParcel", req.params.parcelId);

    res.json({
      data: JSON.parse(raw)
    });

  } catch (err) {
    console.error("Fetch encumbrances error:", err);
    res.status(500).json({ message: "Failed to fetch encumbrances" });
  }
});

// ─── Get Active Encumbrances for a Parcel ────────────────────────────────────

router.get("/:parcelId/active", async (req, res) => {
  try {
    const raw = await evaluateEncumbranceTx("getEncumbrancesByParcel", req.params.parcelId);

    const active = JSON.parse(raw).filter(e => e.status === "ACTIVE");

    res.json({ data: active });

  } catch (err) {
    console.error("Active encumbrances error:", err);
    res.status(500).json({ message: "Failed to fetch active encumbrances" });
  }
});

// ─── Discharge Encumbrance ───────────────────────────────────────────────────

router.post("/:id/discharge", async (req, res) => {
  try {
    const { txId, result } = await submitEncumbranceTx("dischargeEncumbrance", req.params.id);

    
    res.json({
      txId,
      data: JSON.parse(result)
    });

  } catch (err) {
    console.error("Discharge error:", err);
    res.status(500).json({ message: "Failed to discharge encumbrance" });
  }
});





export default router;