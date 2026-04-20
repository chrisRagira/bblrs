import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/by-national-id/:id",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await req.db.execute(
        "SELECT user_id, full_name, national_id, role FROM users WHERE national_id=?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: `User with id ${id} not found` });
      }

      res.json({ data: rows[0] });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

router.get(
  "/by-user-id/:id",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await req.db.execute(
        "SELECT user_id, full_name, national_id, role FROM users WHERE user_id=?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: `User with id ${id} not found` });
      }

      res.json({ data: rows[0] });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;