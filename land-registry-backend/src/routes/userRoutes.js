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
        "SELECT user_id, first_name, last_name, national_id, role FROM users WHERE national_id=?",
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
        "SELECT user_id, first_name, last_name, national_id, role FROM users WHERE user_id=?",
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

router.get("/lookup", verifyToken, async (req, res) => {
  const { nationalId, role } = req.query;
  if (!nationalId) return res.status(400).json({ message: "nationalId is required" });
 
  const [[user]] = await req.db.execute(
    `SELECT user_id, first_name, last_name, role
     FROM users
     WHERE national_id = ? ${role ? "AND role = ?" : ""}`,
    role ? [nationalId, role] : [nationalId]
  );
 
  if (!user) return res.status(404).json({ message: "User not found" });
 
  return res.json({
    data: {
      id:   user.user_id,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
    }
  });
});

export default router;