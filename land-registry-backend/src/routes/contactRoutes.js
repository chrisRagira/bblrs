import express from "express";
const router = express.Router();
import nodemailer from "nodemailer";
// POST /api/contact
router.post("/", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,   // Gmail App Password — no fallback
      },
    });
    

    // Email to support inbox
    await transporter.sendMail({
      from: `"BBLRS Contact Form" <${process.env.EMAIL_USER}>`,
      to: 'princeguy01@gmail.com',     // e.g. support@bblrs.go.ke
      replyTo: email,
      subject: `[BBLRS Contact] ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    

    
    res.json({ success: true, message: "Email sent successfully." });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email. Please try again." });
  }
});

export default router;