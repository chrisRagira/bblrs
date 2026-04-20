import { useEffect, useState } from "react";
import api from "../api/axios";

function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/admin/users").then(res => {
      setUsers(res.data.data);
    });
  }, []);

  return (
    <div className="container mt-4">
      <h2>Users</h2>

      {users.map(u => (
        <div key={u.user_id} className="card p-2 mb-2">
          {u.full_name} ({u.email})
        </div>
      ))}
    </div>
  );
}

export default AdminUsers;