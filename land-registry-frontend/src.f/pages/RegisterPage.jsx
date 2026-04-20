import { useState } from "react";
import api from "../api/axios";

function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    window.location.href = "/dashboard";
  };

  return (
    <div className="container mt-5">
      <h2>Login</h2>

      <input className="form-control mb-2" onChange={e => setEmail(e.target.value)} placeholder="Email"/>
      <input className="form-control mb-2" type="password" onChange={e => setPassword(e.target.value)} placeholder="Password"/>

      <button className="btn btn-primary" onClick={login}>Login</button>
    </div>
  );
}

export default RegisterPage;