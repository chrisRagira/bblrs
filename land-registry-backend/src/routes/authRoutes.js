import express from "express";
import { login, register } from "../controllers/authController.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const [rows] = await req.db.execute(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  if (!rows.length) {
    return res.json({ message: "If email exists, reset link sent." }); // 🔒 avoid leaking users
  }

  const user = rows[0];

  // 🔐 generate token

  const token = crypto.randomBytes(32).toString("hex");  
  const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 mins

  await req.db.execute(
    "UPDATE users SET reset_token = ?, reset_expires = ? WHERE user_id = ?",
    [token, expires, user.user_id]
  );

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "princeguy01@gmail.com",
      pass: process.env.EMAIL_PASS || "zabj xkjo lugd gnvy",  // ⚠️ use app password, not real password
    },
  });
  const resetLink = `http://35.209.144.131:3000/reset-password/${token}`;

  await transporter.sendMail({
    from: `"BBLRS System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h3>Password Reset</h3>
      <p>You requested a password reset.</p>
      <p>Click below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link expires in 10 minutes.</p>
    `,
  });
  res.json({ message: "If email exists, reset link sent." });
});

router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;

  const [rows] = await req.db.execute(
    `SELECT * FROM users 
     WHERE reset_token = ? AND reset_expires > NOW()`,
    [req.params.token]
  );

  if (!rows.length) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  const user = rows[0];

  const bcrypt = require("bcrypt");
  const hashed = await bcrypt.hash(password, 10);

  await req.db.execute(
    `UPDATE users 
     SET password = ?, reset_token = NULL, reset_expires = NULL
     WHERE user_id = ?`,
    [hashed, user.user_id]
  );

  res.json({ message: "Password reset successful" });
});

router.post("/mfa/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Missing fields" });
    }

  

    const [rows] = await req.db.execute(
      `SELECT * FROM users 
       WHERE email = ? AND reset_token IS NOT NULL AND reset_expires > NOW()`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "No OTP found" });
    }

    const user = rows[0];

    // ❌ expired
    if (new Date(user.reset_expires).getTime() < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // ❌ invalid
    if (user.reset_token !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ mark verified
    await req.db.execute(
      "UPDATE users SET reset_token = NULL, reset_expires = NULL WHERE email = ?",
      [user.email]
    );

    const token = jwt.sign(
        { id: user.user_id, role: user.role },
        "secret",
        { expiresIn: "1d" }
      );

    return res.json({
      token,
      role: user.role,
      user: {
        id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;