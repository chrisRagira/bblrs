import { useNavigate } from "react-router-dom";
import { useState } from "react";

function LandingPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  return (
    <div className="container text-center mt-5">
      <h1>Blockchain Land Registry</h1>

      <input
        className="form-control mt-4"
        placeholder="Search by Title Number or Owner ID"
        onChange={(e) => setQuery(e.target.value)}
      />

      <button
        className="btn btn-primary mt-3"
        onClick={() => navigate(`/search?q=${query}`)}
      >
        Search
      </button>
    </div>
  );
}

export default LandingPage;