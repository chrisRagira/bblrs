import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  const [rows] = await req.db.execute(
    `SELECT * FROM notifications
     WHERE user_id = ?
     AND is_read = 0
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.user.id]
  );

  res.json({ data: rows });
});

router.post("/:id/read", verifyToken, async (req, res) => {
  await req.db.execute(
    "UPDATE notifications SET is_read = TRUE WHERE id = ?",
    [req.params.id]
  );

  res.json({ message: "Marked as read" });
});



export default router;