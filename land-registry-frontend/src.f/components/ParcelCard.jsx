import { Link } from "react-router-dom";

function ParcelCard({ parcel }) {
  return (
    <div className="card p-3 mb-3">
      <h5>{parcel.titleNumber}</h5>
      <p>{parcel.county} • {parcel.landUseType}</p>
      <p>Status: {parcel.status}</p>

      <Link className="btn btn-sm btn-primary" to={`/parcels/${parcel.parcelID}`}>
        View Details
      </Link>
    </div>
  );
}

export default ParcelCard;