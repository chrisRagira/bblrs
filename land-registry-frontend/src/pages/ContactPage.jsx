import { useState } from "react";
import { C, font } from "../styles/tokens";
import Button from "../components/ui/Button";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [status, setStatus] = useState(null); // add near other useState

const handleSubmit = async (e) => {
  e.preventDefault();
  setStatus("sending");

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to send.");

    setStatus("success");
    setForm({ name: "", email: "", subject: "", message: "" });
  } catch (err) {
    setStatus("error");
    console.error(err);
  }
};
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
      
      {/* ── Header ───────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 50 }}>
        <h1 style={{
          fontFamily: font.head,
          fontSize: 36,
          color: C.navy,
          marginBottom: 12
        }}>
          Contact Us
        </h1>
        <p style={{ color: C.textSecondary, maxWidth: 600, margin: "0 auto" }}>
          Have questions, issues, or need assistance? Reach out to our support team or visit a land registry office.
        </p>
      </div>

      {/* ── Content Grid ─────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 40
      }}>

        {/* ── Contact Form ───────────────────────── */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)"
          }}
        >
          <h2 style={{
            fontFamily: font.head,
            fontSize: 20,
            marginBottom: 20,
            color: C.navy
          }}>
            Send a Message
          </h2>

          {/* Name */}
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full Name"
            required
            style={inputStyle}
          />

          {/* Email */}
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email Address"
            required
            style={inputStyle}
          />

          {/* Subject */}
          <input
            name="subject"
            value={form.subject}
            onChange={handleChange}
            placeholder="Subject"
            required
            style={inputStyle}
          />

          {/* Message */}
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Your Message..."
            rows={5}
            required
            style={{ ...inputStyle, resize: "none" }}
          />

          <Button type="submit" variant="teal" style={{ marginTop: 10 }} disabled={status === "sending"}>
  {status === "sending" ? "Sending…" : "Send Message"}
</Button>

{status === "success" && (
  <p style={{ color: "green", marginTop: 10, fontSize: 14 }}>
    ✅ Message sent! Check your email for confirmation.
  </p>
)}
{status === "error" && (
  <p style={{ color: "red", marginTop: 10, fontSize: 14 }}>
    ❌ Failed to send. Please try again.
  </p>
)}
        </form>

        {/* ── Contact Info ───────────────────────── */}
        <div>
          <div style={infoCard}>
            <h3 style={infoTitle}>📍 Office Location</h3>
            <p style={infoText}>
              Ministry of Lands Headquarters<br />
              Nairobi, Kenya
            </p>
          </div>

          <div style={infoCard}>
            <h3 style={infoTitle}>📞 Phone</h3>
            <p style={infoText}>+254 700 000 000</p>
          </div>

          <div style={infoCard}>
            <h3 style={infoTitle}>📧 Email</h3>
            <p style={infoText}>support@bblrs.go.ke</p>
          </div>

          <div style={infoCard}>
            <h3 style={infoTitle}>⏰ Working Hours</h3>
            <p style={infoText}>
              Monday - Friday: 8:00 AM - 5:00 PM<br />
              Saturday: 9:00 AM - 1:00 PM
            </p>
          </div>
        </div>
      </div>

      {/* ── Map Section ─────────────────────────── */}
      <div style={{ marginTop: 60 }}>
        <h2 style={{
          fontFamily: font.head,
          fontSize: 22,
          marginBottom: 16,
          color: C.navy
        }}>
          Find Us
        </h2>

        <div style={{
          height: 300,
          background: "#E2E8F0",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.textSecondary
        }}>
          Map integration (Google Maps / Leaflet)
        </div>
      </div>

      {/* ── CTA ───────────────────────────────── */}
      <div style={{
        marginTop: 60,
        textAlign: "center",
        padding: 32,
        background: "#F8FAFC",
        borderRadius: 12
      }}>
        <h3 style={{
          fontFamily: font.head,
          fontSize: 20,
          color: C.navy,
          marginBottom: 10
        }}>
          Need immediate help?
        </h3>
        <p style={{ color: C.textSecondary, marginBottom: 16 }}>
          Visit our FAQ section for quick answers.
        </p>
        <Button onClick={() => window.location.href = "/faq"}>
          Go to FAQ
        </Button>
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────── */
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: 14,
  borderRadius: 6,
  border: "1px solid #CBD5E1",
  fontSize: 14,
  outline: "none"
};

const infoCard = {
  background: "#fff",
  padding: 18,
  borderRadius: 10,
  marginBottom: 16,
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)"
};

const infoTitle = {
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  marginBottom: 6
};

const infoText = {
  fontSize: 14,
  color: C.textSecondary,
  lineHeight: 1.6
};