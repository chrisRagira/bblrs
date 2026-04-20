import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

function ParcelDetail() {
  const { id } = useParams();
  const [parcel, setParcel] = useState(null);

  useEffect(() => {
    api.get(`/parcels/${id}`).then(res => {
      setParcel(res.data.data);
    });
  }, [id]);

  if (!parcel) return <p>Loading...</p>;

  return (
    <div className="container mt-4">
      <h2>{parcel.titleNumber}</h2>
      <p>Owner: {parcel.currentOwner?.fullName}</p>
      <p>Status: {parcel.status}</p>
      <p>County: {parcel.county}</p>
    </div>
  );
}

export default ParcelDetail;