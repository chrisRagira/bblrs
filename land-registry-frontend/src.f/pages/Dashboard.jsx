import { useEffect, useState } from "react";
import api from "../api/axios";

function Dashboard() {
  const [parcels, setParcels] = useState([]);

  useEffect(() => {
    api.get("/parcels/owner/12345678").then(res => {
      setParcels(res.data.data);
    });
  }, []);

  return (
    <div className="container mt-4">
      <h2>My Parcels</h2>

      {parcels.map(p => (
        <div key={p.parcelID} className="card p-3 mb-2">
          {p.titleNumber}
        </div>
      ))}
    </div>
  );
}

export default Dashboard;