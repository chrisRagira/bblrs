import express from "express";
import upload from "../middleware/upload.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadDocument, getDocuments } from "../controllers/documentController.js";

const router = express.Router();

// Upload (Landowner only)
router.post(
  "/upload",
  verifyToken,
  authorizeRoles("LANDOWNER"),
  upload.single("file"),
  uploadDocument
);

// Get parcel documents
router.get(
  "/:parcel_id",
  verifyToken,
  getDocuments
);

export default router;