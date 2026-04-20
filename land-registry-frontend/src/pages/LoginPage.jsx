import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert } from "../components/ui/Feedback";
import Button from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { C, font } from "../styles/tokens";
import ReCAPTCHA from "react-google-recaptcha";
import { useRef } from "react";

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || "/dashboard";

  const [step,     setStep]     = useState(1);   // 1 = credentials, 2 = MFA
  const [form,     setForm]     = useState({ email: "", password: "" });
  const [otp,      setOtp]      = useState(["", "", "", "", "", ""]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const captchaRef = useRef(null);
  const [captchaToken, setCaptchaToken] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  /* ── Step 1: credentials ─────────────────────────────────────── */
  const handleCredentials = async (e) => {
    console.log("submit fired")
    e.preventDefault();
    setError("");
    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!captchaToken) {
      setError("Please complete the CAPTCHA");
      return;
  }
    setLoading(true);
    try {
      const res = await authApi.login({...form,captcha: captchaToken});
      const { requiresMfa, token, role, user } = res.data;

      if (requiresMfa) {
        setStep(2);
      } else {
        login({ token, role, user });
        navigate(from, { replace: true });
      }
    } catch (err) {
        console.log("ERROR:", err);

      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  /* ── Step 2: OTP ─────────────────────────────────────────────── */
  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleOtpPaste = (e) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    setOtp([...digits, ...Array(6 - digits.length).fill("")]);
    document.getElementById(`otp-5`)?.focus();
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyMfa({ email: form.email, otp: otp.join("") });
      const { token, role, user } = res.data;
      login({ token, role, user });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "calc(100vh - 60px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, background: C.bg,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, background: C.tealLt,
            borderRadius: 14, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px", fontSize: 26,
          }}>🏛</div>
          <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy }}>
            {step === 1 ? "Sign in to BBLRS" : "Two-Factor Authentication"}
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 14, marginTop: 6 }}>
            {step === 1
              ? "Kenya Blockchain Land Registry System"
              : `Enter the 6-digit OTP sent to ${form.email}`}
          </p>
        </div>

        <Card>
          {error && <Alert type="danger">{error}</Alert>}

          {/* ── Step 1 ──────────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleCredentials}>
              <FormField
                label="Email Address" name="email" type="email"
                placeholder="you@example.com"
                value={form.email} onChange={set("email")}
                icon="✉" required
              />
              <FormField
                label="Password" name="password" type="password"
                placeholder="••••••••"
                value={form.password} onChange={set("password")}
                icon="🔑" required
              />
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(token) => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
              />

             
              <Link to="/forgot-password" style={{ color: C.teal }}>
                Forgot password?
              </Link>


              <Button type="submit" full disabled={loading}>
                {loading ? "Authenticating…" : "Sign In"}
              </Button>

              <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.textSecondary }}>
                Don't have an account?{" "}
                <Link to="/register" style={{ color: C.teal }}>Register here</Link>
              </p>
            </form>
          )}

          {/* ── Step 2: MFA ──────────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleMfa}>
              <Alert type="info">
                An OTP has been sent to your registered email. This code expires in 10 minutes.
              </Alert>

              {/* OTP boxes */}
              <div style={{
                display: "flex", gap: 10, justifyContent: "center",
                margin: "24px 0",
              }}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: 44, height: 52, textAlign: "center",
                      fontSize: 22, fontWeight: 600,
                      border: `1.5px solid ${digit ? C.teal : C.border}`,
                      borderRadius: 8, outline: "none",
                      transition: "border-color 0.15s",
                    }}
                  />
                ))}
              </div>

              <Button type="submit" full disabled={loading || otp.join("").length < 6}>
                {loading ? "Verifying…" : "Verify OTP"}
              </Button>

              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textSecondary }}>
                Didn't receive it?{" "}
                <button type="button" style={{
                  background: "none", border: "none",
                  color: C.teal, cursor: "pointer", fontSize: 13,
                }}>Resend OTP</button>
              </p>

              <button type="button" onClick={() => { setStep(1); setError(""); }} style={{
                display: "block", width: "100%", marginTop: 10,
                background: "none", border: "none",
                color: C.textSecondary, fontSize: 13, cursor: "pointer",
              }}>← Back to login</button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
