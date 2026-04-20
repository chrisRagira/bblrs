import { useEffect, useState } from "react";
import api from "../api/axios";
import ParcelCard from "../components/ParcelCard";

function SearchResults() {
  const [parcels, setParcels] = useState([]);

  useEffect(() => {
    api.get("/parcels/search").then(res => {
      setParcels(res.data.data || []);
    });
  }, []);

  return (
    <div className="container mt-4">
      <h2>Search Results</h2>

      {parcels.map(p => (
        <ParcelCard key={p.parcelID} parcel={p} />
      ))}
    </div>
  );
}

export default SearchResults;