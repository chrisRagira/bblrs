import { useState } from "react";
import api from "../api/axios";

function TransferForm() {
  const [parcelID, setParcelID] = useState("");
  const [newOwner, setNewOwner] = useState("");

  const submit = async () => {
    await api.post("/transfers", {
      parcelID,
      newOwnerID: newOwner
    });
    alert("Transfer initiated");
  };

  return (
    <div className="container mt-4">
      <h2>Transfer Ownership</h2>

      <input className="form-control mb-2" placeholder="Parcel ID" onChange={e => setParcelID(e.target.value)}/>
      <input className="form-control mb-2" placeholder="New Owner ID" onChange={e => setNewOwner(e.target.value)}/>

      <button className="btn btn-success" onClick={submit}>Submit</button>
    </div>
  );
}

export default TransferForm;