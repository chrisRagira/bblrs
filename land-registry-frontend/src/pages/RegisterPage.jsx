import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const ROLE_OPTIONS = [
  { value: "LANDOWNER",  label: "Landowner" },
  { value: "LEGAL",      label: "Legal Officer" },
  { value: "REGISTRAR",  label: "Registrar" },
];

const STEPS = ["Personal Info", "Account Setup", "Confirmation"];

const PWD_RULES = [
  { label: "At least 8 characters",      test: (p) => p.length >= 8 },
  { label: "One uppercase letter",        test: (p) => /[A-Z]/.test(p) },
  { label: "One number",                  test: (p) => /\d/.test(p) },
  { label: "One special character",       test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const [personal, setPersonal] = useState({
    fullName: "", nationalId: "", email: "", phoneNumber: "", role: "LANDOWNER",
  });
  const [security, setSecurity] = useState({ password: "", confirm: "" });

  const setP = (field) => (e) => setPersonal((s) => ({ ...s, [field]: e.target.value }));
  const setS = (field) => (e) => setSecurity((s) => ({ ...s, [field]: e.target.value }));

  const pwdValid = PWD_RULES.every((r) => r.test(security.password));
  const step1Valid = personal.fullName && personal.nationalId && personal.email && personal.phoneNumber;
  const step2Valid = pwdValid && security.password === security.confirm;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await authApi.register({
        fullName:    personal.fullName,
        nationalId:  personal.nationalId,
        email:       personal.email,
        phoneNumber: personal.phoneNumber,
        role:        personal.role,
        password:    security.password,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: C.bg, padding: "40px 24px" }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: font.head, fontSize: 26, fontWeight: 600, color: C.navy }}>
            Create Your Account
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 14, marginTop: 6 }}>
            Join the Blockchain Land Registry System
          </p>
        </div>

        <StepBar steps={STEPS} current={step} />

        <Card>
          {error && <Alert type="danger">{error}</Alert>}

          {/* ── Step 1: Personal ──────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="grid-2">
                <FormField label="Full Name"   name="fullName"   placeholder="John Kamau"
                  value={personal.fullName}   onChange={setP("fullName")}   required />
                <FormField label="National ID" name="nationalId" placeholder="12345678"
                  value={personal.nationalId} onChange={setP("nationalId")} required />
              </div>
              <FormField label="Email Address" name="email" type="email"
                placeholder="john@example.com"
                value={personal.email} onChange={setP("email")} required />
              <FormField label="Phone Number" name="phoneNumber"
                placeholder="+254 700 000 000"
                value={personal.phoneNumber} onChange={setP("phoneNumber")} required />
              <SelectField
                label="Account Role" name="role"
                value={personal.role} onChange={setP("role")}
                options={ROLE_OPTIONS} required
              />
              <Button full onClick={() => setStep(2)} disabled={!step1Valid}>
                Continue
              </Button>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.textSecondary }}>
                Already registered? <Link to="/login" style={{ color: C.teal }}>Sign in</Link>
              </p>
            </>
          )}

          {/* ── Step 2: Security ──────────────────────────────────── */}
          {step === 2 && (
            <>
              <FormField label="Password" name="password" type="password"
                placeholder="Minimum 8 characters"
                value={security.password} onChange={setS("password")} required />

              {/* Password rules checklist */}
              <div style={{
                background: C.bg, borderRadius: 8,
                padding: 14, marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.navy, marginBottom: 8 }}>
                  Password Requirements
                </p>
                {PWD_RULES.map((r) => {
                  const ok = r.test(security.password);
                  return (
                    <div key={r.label} style={{
                      display: "flex", alignItems: "center",
                      gap: 8, marginBottom: 4,
                    }}>
                      <span style={{ color: ok ? C.success : C.border, fontSize: 13, fontWeight: 600 }}>
                        {ok ? "✓" : "○"}
                      </span>
                      <span style={{ fontSize: 12, color: ok ? C.success : C.textSecondary }}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <FormField label="Confirm Password" name="confirm" type="password"
                placeholder="Repeat password"
                value={security.confirm} onChange={setS("confirm")}
                helper={security.confirm && security.password !== security.confirm
                  ? "Passwords do not match."
                  : undefined}
                required />

              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button full onClick={handleSubmit} disabled={!step2Valid || loading}>
                  {loading ? "Creating account…" : "Create Account"}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Confirmation ──────────────────────────────── */}
          {step === 3 && (
            <>
              <Alert type="success">
                Account created successfully! Your Fabric identity has been enrolled.
              </Alert>

              <div style={{ background: C.bg, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                {[
                  ["Full Name",  personal.fullName],
                  ["National ID", personal.nationalId],
                  ["Role",       personal.role],
                  ["Email",      personal.email],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: `1px solid ${C.border}`,
                    fontSize: 13,
                  }}>
                    <span style={{ color: C.textSecondary }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              <Button full onClick={() => navigate("/login")}>
                Proceed to Sign In
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
