import express from "express";
import upload from "../middleware/upload.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { submitTx, evaluateTx } from "../fabric.js";
import ipfs from "../config/ipfs.js";

const router = express.Router();

// ─── Public Search ───────────────────────────────────────────────────────────

router.get("/search", async (req, res) => {
  try {
    const { q, status, page = 1, limit = 10 } = req.query;

    // DO NOT SEARCH WITHOUT QUERY
    if (!q || q.trim() === "") {
      return res.json({
        data: [],
        total: 0,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    const like = `%${q}%`;
    conditions.push(`
      (
        p.title_number LIKE ? 
        OR p.county LIKE ? 
        OR u.national_id LIKE ?
      )
    `);
    params.push(like, like, like);

    if (status && status !== "ALL") {
      conditions.push(`p.status = ?`);
      params.push(status);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const [[{ total }]] = await req.db.execute(
      `
      SELECT COUNT(*) AS total
      FROM parcels p
      JOIN users u ON p.owner_id = u.user_id
      ${where}
      `,
      params
    );

    const [rows] = await req.db.execute(
      `
      SELECT 
        p.parcel_id,
        p.title_number,
        p.owner_id,
        p.county,
        p.sub_county,
        p.ward,
        p.status,
        p.area_hectares,
        p.land_use_type,
        p.gps_coordinates,
        p.blockchain_ref,

        u.user_id AS owner_user_id,
        u.full_name AS owner_full_name

      FROM parcels p
      JOIN users u ON p.owner_id = u.user_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, parseInt(limit), offset]
    );

    const data = rows.map(row => ({
      parcelID: row.parcel_id,
      titleNumber: row.title_number,
      ownerID: row.owner_id,
      county: row.county,
      subCounty: row.sub_county,
      ward: row.ward,
      status: row.status,
      areaHectares: row.area_hectares,
      landUseType: row.land_use_type,
      gpsCoordinates: row.gps_coordinates,
      blockchainRef: row.blockchain_ref,
      owner: {
        userID: row.owner_user_id,
        fullName: row.owner_full_name
      }
    }));

    res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Get Parcel Details (Public) ─────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `
      SELECT 
        p.parcel_id,
        p.title_number,
        p.owner_id,
        p.county,
        p.sub_county,
        p.ward,
        p.status,
        p.area_hectares,
        p.land_use_type,
        p.gps_coordinates,
        p.blockchain_ref,
        p.created_at,

        u.user_id   AS owner_user_id,
        u.full_name AS owner_full_name,
        u.email     AS owner_email

      FROM parcels p
      JOIN users u ON p.owner_id = u.user_id
      WHERE p.parcel_id = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.json({ message: "Parcel not found" });
    }

    const row = rows[0];

    res.json({
      data: {
        parcelID: row.parcel_id,
        titleNumber: row.title_number,
        ownerID: row.owner_id,
        county: row.county,
        subCounty: row.sub_county,
        ward: row.ward,
        status: row.status,
        areaHectares: row.area_hectares,
        landUseType: row.land_use_type,
        gpsCoordinates: row.gps_coordinates,
        blockchainRef: row.blockchain_ref,
        createdAt: row.created_at,
        owner: {
          userID: row.owner_user_id,
          fullName: row.owner_full_name,
          email: row.owner_email
        }
      }
    });

  } catch (error) {
    console.error("Parcel fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Create Parcel (REGISTRAR only) ──────────────────────────────────────────

router.post(
  "/",
  verifyToken,
  authorizeRoles("REGISTRAR"),
  upload.single("document"),
  async (req, res) => {
    try {
      let {
        titleNumber,
        county,
        subCounty,
        ward,
        areaHectares,
        landUseType,
        gpsCoordinates,
        ownerNationalId,
        registrationDate
      } = req.body;

      const file = req.file;

      if (gpsCoordinates && typeof gpsCoordinates === "string") {
        try {
          gpsCoordinates = JSON.parse(gpsCoordinates);
        } catch (e) {
          return res.status(400).json({
            message: "Invalid gpsCoordinates format. Must be valid JSON."
          });
        }
      }

      if (!titleNumber || !ownerNationalId || !county) {
        return res.status(400).json({
          message: "Missing required fields (titleNumber, ownerNationalId, county)"
        });
      }

      const [users] = await req.db.execute(
        "SELECT user_id, full_name FROM users WHERE national_id=?",
        [ownerNationalId]
      );

      if (users.length === 0) {
        return res.json({ message: "Owner not found" });
      }

      const owner = users[0];

      let cid = null;
      if (file) {
        const result = await ipfs.add(file.buffer);
        cid = result.path;
      }

      const { txId } = await submitTx(
        "createParcel",
        titleNumber,
        county,
        subCounty || "",
        ward || "",
        areaHectares ? areaHectares.toString() : "0",
        landUseType,
        JSON.stringify(gpsCoordinates || {}),
        ownerNationalId,
        registrationDate || "",
        req.user.id.toString(),
        cid || ""
      );

      await req.db.execute(
        `INSERT INTO parcels 
        (title_number, owner_id, county, sub_county, ward, status, area_hectares, land_use_type, gps_coordinates, blockchain_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          titleNumber,
          owner.user_id,
          county,
          subCounty || null,
          ward || null,
          "ACTIVE",
          areaHectares || null,
          landUseType,
          gpsCoordinates || null,
          txId
        ]
      );

      if (cid) {
        await req.db.execute(
          `INSERT INTO documents 
          (parcel_id, owner_id, file_name, cid)
          VALUES (?, ?, ?, ?)`,
          [titleNumber, owner.user_id, file.originalname, cid]
        );
      }

      await req.db.execute(
        `INSERT INTO audit_logs 
        (entity, entity_id, action, actor_id, blockchain_ref)
        VALUES (?, ?, ?, ?, ?)`,
        ["PARCEL", titleNumber, "CREATE_WITH_DOC", req.user.id, txId]
      );

      return res.status(201).json({
        message: "Parcel created successfully",
        titleNumber,
        txId,
        cid,
        ipfsUrl: cid
          ? `https://8080-01kmcr59jamcx2p9mvdbn0h329.cloudspaces.litng.ai/ipfs/${cid}`
          : null
      });

    } catch (error) {
      console.error("🔥 FABRIC TX ERROR FULL:", {
        message: error.message,
        stack: error.stack,
        details: error.details
      });
      return res.status(500).json({
        message: error.message || "Failed to create parcel",
        error: error.details || null
      });
    }
  }
);

// ─── Ownership History (Blockchain) ──────────────────────────────────────────

router.get("/:id/history", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
    "SELECT * FROM parcels WHERE parcel_id=?",
    [req.params.id]
  );
  const titleNumber=rows[0].title_number
    const raw = await evaluateTx("getOwnershipHistory", titleNumber);
    const history = JSON.parse(raw);

    res.json({
      data: history
    });

  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

// ─── Parcel Documents (Blockchain) ───────────────────────────────────────────

router.get("/:id/documents", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
    "SELECT * FROM parcels WHERE parcel_id=?",
    [req.params.id]
  );
   const titleNumber=rows[0].title_number
    const raw = await evaluateTx("getParcel", titleNumber);
    const parcel = JSON.parse(raw);
    console.log('!!!!!!!!!!!')

    const docs = parcel?.document
      ? [{
          name: "Title Deed",
          docType: parcel.document.type,
          cid: parcel.document.cid,
          date: parcel.registration?.date
        }]
      : [];

    res.json({ data: docs });
    
  } catch (err) {
    console.error("Docs error:", err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

router.get("/owner/:id", async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      "SELECT * FROM parcels WHERE owner_id=?",
      [req.params.id]
    );

    if (!rows.length) {
      return res.json({ message: "Parcels not found" });
    }
    const data= rows.map(row => ({
        parcelID: row.parcel_id,
        titleNumber: row.title_number,
        ownerID: row.owner_id,
        county: row.county,
        subCounty: row.sub_county,
        ward: row.ward,
        status: row.status,
        areaHectares: row.area_hectares,
        landUseType: row.land_use_type,
        gpsCoordinates: row.gps_coordinates,
        blockchainRef: row.blockchain_ref
      })) 
// 
      console.log(data)


    res.json({
      data:data
    });

  } catch (error) {
    console.error("Parcel fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;