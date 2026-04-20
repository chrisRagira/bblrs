import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get my parcels
router.get(
  "/parcels",
  verifyToken,
  authorizeRoles("LANDOWNER","LEGAL"),
  async (req, res) => {
    const userId = req.user.id;

    const [rows] = await req.db.execute(
      "SELECT * FROM parcels WHERE owner_id=?",
      [userId]
    );

    res.json({ data: rows });
  }
);

// Initiate transfer
router.post(
  "/transfers",
  verifyToken,
  authorizeRoles("LANDOWNER"),
  async (req, res) => {
    const { parcel_id, new_owner_id } = req.body;

    await req.db.execute(
      "INSERT INTO transfers (parcel_id, new_owner_id, status) VALUES (?, ?, 'PENDING')",
      [parcel_id, new_owner_id]
    );

    res.json({ message: "Transfer initiated" });
  }
);

export default router;