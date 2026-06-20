import express from "express";
import upload from "../middleware/upload.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadDocument, getDocuments } from "../controllers/documentController.js";

const router = express.Router();

// Upload (Landowner only)
router.post(
  "/upload",
  verifyToken,
  authorizeRoles("BUYER/SELLER"),
  upload.single("file"),
  uploadDocument
);

// Get parcel documents
router.get(
  "/:parcel_id",
  verifyToken,
  getDocuments
);

router.post(
  "/verify",
  verifyToken,
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    let {
        titleNumber
      } = req.body;

    const [parcel] = await req.db.execute(
        "SELECT * FROM transfer_documents WHERE national_id=?",
        [ownerNationalId]
      );
  }
);
export default router;