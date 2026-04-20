import axios from "axios";

const api = axios.create({
  baseURL: "https://3000-01kmcr59jamcx2p9mvdbn0h329.cloudspaces.litng.ai/api/v1",
});

// Attach JWT automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;