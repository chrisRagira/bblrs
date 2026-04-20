import { useEffect, useState } from "react";
import api from "../api/axios";

function RegistrarQueue() {
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    api.get("/transfers/pending").then(res => {
      setTransfers(res.data.data);
    });
  }, []);

  return (
    <div className="container mt-4">
      <h2>Pending Transfers</h2>

      {transfers.map(t => (
        <div key={t.transferID} className="card p-3 mb-2">
          <p>{t.parcelID}</p>
          <button onClick={() => api.patch(`/transfers/${t.transferID}/approve`)} className="btn btn-success">Approve</button>
        </div>
      ))}
    </div>
  );
}

export default RegistrarQueue;