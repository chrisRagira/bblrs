import express from "express";
import cors from "cors";
import morgan from "morgan";

import documentRoutes from "./routes/documentRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import registrarRoutes from "./routes/registrarRoutes.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import parcelRoutes from "./routes/parcelRoutes.js";
import encumbranceRoutes from "./routes/encumbranceRoutes.js"
import transferRoutes from "./routes/transferRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
const app = express();

import db from "./config/db.js";

app.use((req, res, next) => {
  req.db = db;
  next();
});

const corsOptions = {
  origin: "http://35.209.144.131:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// 1. Apply cors middleware globally
app.use(cors(corsOptions));

// 2. Explicitly handle ALL preflight requests BEFORE any routes
app.options("/{*path}", cors(corsOptions));

app.use(express.json());
app.use(morgan("dev"));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/parcels", parcelRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/registrar", registrarRoutes);
app.use("/api/v1/owner", ownerRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/transfers", transferRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/encumbrances", encumbranceRoutes);

app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(500).json({ error: err.message });
});
export default app;
