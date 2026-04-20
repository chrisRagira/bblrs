import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar navbar-dark bg-dark px-4">
      <Link className="navbar-brand" to="/">Land Registry</Link>

      <div>
        <Link className="btn btn-outline-light me-2" to="/search">Search</Link>
        <Link className="btn btn-outline-light me-2" to="/dashboard">Dashboard</Link>
        <Link className="btn btn-warning" to="/login">Login</Link>
      </div>
    </nav>
  );
}

export default Navbar;