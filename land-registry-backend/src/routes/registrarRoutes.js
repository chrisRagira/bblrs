import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// View pending transfers
router.get(
  "/transfers/pending",
  verifyToken,
  authorizeRoles("REGISTRAR",'CLERK','COUNTY_OFFICER','VALUER'),
  async (req, res) => {
    try {
      const [rows] = await req.db.execute(
        `SELECT 
          t.transfer_id, t.transfer_type, t.sale_price, t.ipfs_cid,
          t.blockchain_ref, t.status, t.transferred_at,

          p.parcel_id, p.title_number, p.county, p.sub_county,
          p.ward, p.area_hectares, p.land_use_type,

          prev.user_id        AS prev_owner_id,
          prev.first_name     AS prev_owner_first_name,
          prev.last_name      AS prev_owner_last_name,
          prev.national_id    AS prev_owner_national_id,
          prev.email          AS prev_owner_email,
          prev.phone_number   AS prev_owner_phone,

          new_o.user_id       AS new_owner_id,
          new_o.first_name    AS new_owner_first_name,
          new_o.last_name     AS new_owner_last_name,
          new_o.national_id   AS new_owner_national_id,
          new_o.email         AS new_owner_email,
          new_o.phone_number  AS new_owner_phone

        FROM transfers t
        JOIN parcels p   ON t.parcel_id = p.parcel_id
        JOIN users prev  ON t.previous_owner_id = prev.user_id
        JOIN users new_o ON t.new_owner_id = new_o.user_id

        WHERE t.status <> 'APPROVED'
        ORDER BY t.transferred_at DESC`
      );

      res.json({ data: rows });

    } catch (err) {
      console.error("🔥 FETCH PENDING TRANSFERS ERROR:", err);
      res.status(500).json({
        message: "Failed to fetch pending transfers"
      });
    }
  }
);



export default router;