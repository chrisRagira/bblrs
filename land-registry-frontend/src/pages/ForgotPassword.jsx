import { useState } from "react";
import { authApi } from "../api/services";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { Alert } from "../components/ui/Feedback";
import Button from "../components/ui/Button";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    try {
      const res = await authApi.forgotPassword({ email });
      setMsg(res.data.message);
    } catch (err) {
      setError("Something went wrong");
    }
  };

  return (
    <div className="page-wrapper">
      <Card>
        <h2>Forgot Password</h2>

        {msg && <Alert type="success">{msg}</Alert>}
        {error && <Alert type="danger">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <FormField
            label="Email Address" name="email" type="email"
                placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)} required
          />
          <Button type="submit" full>Send Reset Link</Button>
        </form>
      </Card>
    </div>
  );
}