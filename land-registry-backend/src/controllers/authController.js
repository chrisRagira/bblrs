import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import db from "../config/db.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import axios     from "axios";


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Gmail App Password — no fallback
  },
});


export const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      nationalId,
      phoneNumber
    } = req.body;

    // ✅ validation
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "Full name, email and password are required"
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const safeRole = role || "LANDOWNER";

    const [result] = await req.db.execute(
      `INSERT INTO users 
      (full_name, email, password, role,national_id,phone_number) 
      VALUES (?, ?, ?, ?,?,?)`,
      [fullName, email, hashed, safeRole, nationalId, phoneNumber]
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: result.insertId
    });

  } catch (err) {
    console.error("🔥 REGISTER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};





// ── POST /auth/login ─────────────────────────────────────────────────────────
export const login = async (req, res) => {
  const { email, password, captcha } = req.body;

  if (!captcha) {
    return res.status(400).json({ message: "Captcha required" });
  }

  try {
    const captchaRes = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret:   process.env.RECAPTCHA_SECRET_KEY,
          response: captcha,
          remoteip: req.ip,
        },
      }
    );
  console.log(captchaRes.data,process.env.RECAPTCHA_SECRET_KEY,captcha);

    if (!captchaRes.data.success) {
      return res.status(400).json({ message: "Captcha verification failed" });
    }

    // 3. Look up user
    const [rows] = await req.db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    // 4. Check password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const otp     = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await req.db.execute(
      "UPDATE users SET reset_token = ?, reset_expires = ? WHERE user_id = ?",
      [otp, expires, user.user_id]
    );

    await transporter.sendMail({
      from:    `"BBLRS System" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: "Your Login OTP — BBLRS Kenya",
      html: `
        <h3>One-Time Password</h3>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
      `,
    });

    return res.json({
      requiresMfa: true,
      userId: user.user_id,   // frontend needs this to call /auth/mfa/verify
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

// ── POST /auth/mfa/verify ────────────────────────────────────────────────────
export const verifyMfa = async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const [rows] = await req.db.execute(
      "SELECT * FROM users WHERE user_id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    if (user.reset_token !== otp || new Date() > new Date(user.reset_expires)) {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    await req.db.execute(
      "UPDATE users SET reset_token = NULL, reset_expires = NULL WHERE user_id = ?",
      [user.user_id]
    );

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      requiresMfa: false,
      token,
      role: user.role,
      user: {
        id:       user.user_id,
        fullName: user.full_name,
        email:    user.email,
      },
    });

  } catch (err) {
    console.error("MFA verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};