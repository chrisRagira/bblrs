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
  first_name,
  middle_name,
  last_name,
  email,
  password,
  role,
  national_id,
  kra_pin,
  phone_number
} = req.body;
console.log(req.body);

    // ✅ validation
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        message: "First name, last name, email and password are required"
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const safeRole = role || "SELLER/BUYER";

    const [result] = await req.db.execute(
      `INSERT INTO users 
      (first_name, middle_name, last_name, email, password, role,national_id,kra_pin,phone_number) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, middle_name || "", last_name, email, hashed, safeRole, national_id, kra_pin, phone_number]
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: result.insertId
    });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      let message = "Duplicate entry";

      // Detect which field caused the error
      if (err.sqlMessage.includes("email")) {
        message = "Email already registered";
      } else if (err.sqlMessage.includes("national_id")) {
        message = "National ID already registered";
      } else if (err.sqlMessage.includes("kra_pin")) {
        message = "KRA PIN already registered";
      } else if (err.sqlMessage.includes("phone_number")) {
        message = "Phone number already registered";
      }

      return res.status(400).json({ message });
    }

    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};





// ── POST /auth/login ─────────────────────────────────────────────────────────
export const login = async (req, res) => {
  const { email, password, captcha } = req.body;
  const requiresMfa = false;

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

    if (requiresMfa) {

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
        requiresMfa: requiresMfa,
        userId: user.user_id,   // frontend needs this to call /auth/mfa/verify
      });
    }

    // 5. Create JWT
    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
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

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};
