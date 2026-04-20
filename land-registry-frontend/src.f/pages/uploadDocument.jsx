import { useState } from "react";
import api from "../api/axios";

function UploadDocument() {
  const [file, setFile] = useState(null);
  const [parcelId, setParcelId] = useState("");

  const upload = async () => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("parcel_id", parcelId);

    await api.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    alert("Uploaded!");
  };

  return (
    <div>
      <input placeholder="Parcel ID" onChange={e => setParcelId(e.target.value)} />
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={upload}>Upload</button>
    </div>
  );
}

export default UploadDocument;