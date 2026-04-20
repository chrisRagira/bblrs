import express from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all users
router.get(
  "/users",
  verifyToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    const [users] = await req.db.execute("SELECT * FROM users");
    res.json({ data: users });
  }
);

// Delete user
router.delete(
  "/users/:id",
  verifyToken,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    await req.db.execute("DELETE FROM users WHERE user_id=?", [req.params.id]);
    res.json({ message: "User deleted" });
  }
);

export default router;