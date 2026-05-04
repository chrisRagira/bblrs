import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../api/services";
import { FormField, SelectField } from "../components/ui/FormField";
import { Alert, StepBar } from "../components/ui/Feedback";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { C, font } from "../styles/tokens";

const ROLE_OPTIONS = [
  { value: "BUYER/SELLER", label: "Buyer/Seller" },
  { value: "REGISTRAR", label: "Land Registrar" },
  { value: 'CLERK', label: 'Clerk'},
  { value: "VALUER", label: "Government Valuer" },
  { value: "LAND_CONTROL_BOARD", label: "Land Control Board Officer" },
  { value: "SURVEYOR", label: "Surveyor" },
  { value: "ADVOCATE", label: "Advocate (Lawyer)" },
  { value: "COUNTY_OFFICER", label: "County Government Officer" },
];

const STEPS = ["Personal Info", "Account Setup", "Confirmation"];

const PWD_RULES = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const VALIDATORS = {
  name: (v) => /^[A-Za-z\s'-]{2,50}$/.test(v),

  nationalId: (v) => /^[0-9]{6,10}$/.test(v),

  kraPin: (v) => /^[A-Z]{1}[0-9]{9}[A-Z]{1}$/.test(v),

  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),

  phone: (v) => /^(?:\+254|0)?7[0-9]{8}$/.test(v),

  role: (v) => !!v,
};



export default function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [personal, setPersonal] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    national_id: "",
    kra_pin: "",
    email: "",
    phone_number: "",
    role: "",
  });
  const [security, setSecurity] = useState({ password: "", confirm: "" });
  const validateStep1 = () => {
    const e = {};

    if (!VALIDATORS.name(personal.first_name))
      e.first_name = "Enter a valid first name (letters only)";

    if (personal.middle_name && !VALIDATORS.name(personal.middle_name))
      e.middle_name = "Invalid middle name";

    if (!VALIDATORS.name(personal.last_name))
      e.last_name = "Enter a valid last name";

    if (!VALIDATORS.nationalId(personal.national_id))
      e.national_id = "National ID must be 6–10 digits";

    if (!VALIDATORS.kraPin(personal.kra_pin))
      e.kra_pin = "Invalid KRA PIN (e.g. A123456789B)";

    if (!VALIDATORS.email(personal.email))
      e.email = "Invalid email address";

    if (!VALIDATORS.phone(personal.phone_number))
      e.phone_number = "Use format +2547XXXXXXXX";

    if (!VALIDATORS.role(personal.role))
      e.role = "Please select a role";

    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const validateField = (field, value) => {
    switch (field) {
      case "first_name":
      case "middle_name":
      case "last_name":
        return VALIDATORS.name(value) ? "" : "Invalid name";

      case "national_id":
        return VALIDATORS.nationalId(value) ? "" : "Invalid ID";

      case "kra_pin":
        return VALIDATORS.kraPin(value) ? "" : "Invalid KRA PIN";

      case "email":
        return VALIDATORS.email(value) ? "" : "Invalid email";

      case "phone_number":
        return VALIDATORS.phone(value) ? "" : "Invalid phone";

      default:
        return "";
    }
  };
  const setP = (field) => (e) => {
    const value = e.target.value;

    setPersonal((prev) => ({ ...prev, [field]: value }));

    // live validation
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, value),
    }));
  };
  const setS = (field) => (e) => setSecurity((s) => ({ ...s, [field]: e.target.value }));

  const pwdValid = PWD_RULES.every((r) => r.test(security.password));
  const step1Valid =
    personal.first_name &&
    personal.last_name &&
    personal.national_id &&
    personal.kra_pin &&
    personal.email &&
    personal.phone_number &&
    personal.role;
  const step2Valid = pwdValid && security.password === security.confirm;

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await authApi.register({
        first_name: personal.first_name,
        middle_name: personal.middle_name,
        last_name: personal.last_name,
        national_id: personal.national_id,
        email: personal.email,
        phone_number: personal.phone_number,
        kra_pin: personal.kra_pin,
        role: personal.role,
        password: security.password,
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
              <div className="grid-3">
                <FormField
                  label="First Name"
                  name="first_name"
                  placeholder="John"
                  value={personal.first_name}
                  onChange={setP("first_name")}
                  helper={errors.first_name}
                  required
                />

                <FormField
                  label="Middle Name"
                  name="middle_name"
                  placeholder="Kamau"
                  value={personal.middle_name}
                  helper={errors.middle_name}
                  onChange={setP("middle_name")}
                />

                <FormField
                  label="Last Name"
                  name="last_name"
                  placeholder="Doe"
                  value={personal.last_name}
                  onChange={setP("last_name")}
                  helper={errors.last_name}
                  required
                />
              </div>

              <div className="grid-2">
                <FormField
                  label="National ID"
                  name="national_id"
                  placeholder="12345678"
                  value={personal.national_id}
                  onChange={setP("national_id")}
                  helper={errors.national_id}
                  required
                />

                <FormField
                  label="KRA PIN"
                  name="kra_pin"
                  placeholder="A123456789B"
                  value={personal.kra_pin}
                  onChange={setP("kra_pin")}
                  helper={errors.kra_pin}
                  required
                />
              </div>

              <FormField
                label="Email Address"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={personal.email}
                onChange={setP("email")}
                helper={errors.email}
                required
              />

              <FormField
                label="Phone Number"
                name="phone_number"
                placeholder="+254700000000"
                value={personal.phone_number}
                onChange={setP("phone_number")}
                helper={errors.phone_number}
                required
              />

              <SelectField
                label="Account Role"
                name="role"
                value={personal.role}
                onChange={setP("role")}
                options={ROLE_OPTIONS}
                required
              />

              <Button full onClick={() => { if (validateStep1()) setStep(2); }} disabled={!step1Valid}>
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
              <FormField
                label="Password"
                name="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={security.password}
                onChange={setS("password")}
                required
              />

              {/* Password rules checklist */}
              <div style={{
                background: C.bg,
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.navy, marginBottom: 8 }}>
                  Password Requirements
                </p>
                {PWD_RULES.map((r) => {
                  const ok = r.test(security.password);
                  return (
                    <div key={r.label} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
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

              <FormField
                label="Confirm Password"
                name="confirm"
                type="password"
                placeholder="Repeat password"
                value={security.confirm}
                onChange={setS("confirm")}
                helper={
                  security.confirm && security.password !== security.confirm
                    ? "Passwords do not match."
                    : undefined
                }
                required
              />

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
                  ["First Name", personal.first_name],
                  ["Middle Name", personal.middle_name],
                  ["Last Name", personal.last_name],
                  ["National ID", personal.national_id],
                  ["KRA PIN", personal.kra_pin],
                  ["Role", personal.role],
                  ["Email", personal.email],
                  ["Phone Number", personal.phone_number],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 0",
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 13,
                    }}
                  >
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
