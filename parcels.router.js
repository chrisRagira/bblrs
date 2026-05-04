router.get("/search", async (req, res) => {
  const { q, status, page = 1, limit = 10, paymentId } = req.query;

  if (!q || q.trim() === "") {
    return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
  }

  // Registrars bypass payment entirely
  const isRegistrar = req.user?.role === "registrar";

  if (!isRegistrar) {
    if (paymentId) {
      const [rows] = await req.db.execute(
        `SELECT status FROM search_payments
         WHERE id = ? AND query = ? AND expires_at > NOW()`,
        [paymentId, q.trim()]
      );

      if (rows.length === 0 || rows[0].status !== "PAID") {
        return res.status(402).json({ message: "Payment required or not confirmed yet." });
      }
    } else {
      return res.status(402).json({ message: "Payment required to search." });
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params     = [];
  const like       = `%${q}%`;

  conditions.push(`(p.title_number LIKE ? OR p.county LIKE ? OR u.national_id LIKE ?)`);
  params.push(like, like, like);

  if (status && status !== "ALL") {
    conditions.push(`p.status = ?`);
    params.push(status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [[{ total }]] = await req.db.execute(
    `SELECT COUNT(*) AS total FROM parcels p JOIN users u ON p.owner_id = u.user_id ${where}`,
    params
  );

  const [rows] = await req.db.execute(
    `SELECT p.parcel_id, p.title_number, p.owner_id, p.county, p.sub_county,
            p.ward, p.status, p.area_hectares, p.land_use_type,
            p.gps_coordinates, p.blockchain_ref,
            u.user_id AS owner_user_id, u.full_name AS owner_full_name
     FROM parcels p JOIN users u ON p.owner_id = u.user_id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const data = rows.map(row => ({
    parcelID:     row.parcel_id,
    titleNumber:  row.title_number,
    county:       row.county,
    subCounty:    row.sub_county,
    ward:         row.ward,
    status:       row.status,
    areaHectares: row.area_hectares,
    landUseType:  row.land_use_type,
    owner:        { userID: row.owner_user_id, fullName: row.owner_full_name },
  }));

  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

// ─── Get Parcel Details (Payment-gated) ──────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    // Fetch the parcel first — we need owner_id before we can decide on payment
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
      return res.status(404).json({ message: "Parcel not found" });
    }

    const row = rows[0];

    const isRegistrar = req.user?.role === "registrar";
    const isOwner     = req.user?.id === row.owner_user_id;

    // Only enforce payment if the requester is neither a registrar nor the owner
    if (!isRegistrar && !isOwner) {
      const { paymentId } = req.query;

      if (!paymentId) {
        return res.status(402).json({ message: "Payment required to view parcel details." });
      }

      const [payRows] = await req.db.execute(
        `SELECT id FROM search_payments
         WHERE id = ? AND status = 'PAID' AND expires_at > NOW()
         LIMIT 1`,
        [paymentId]
      );

      if (!payRows.length) {
        return res.status(402).json({ message: "Payment required or session expired." });
      }
    }

    res.json({
      data: {
        parcelID:       row.parcel_id,
        titleNumber:    row.title_number,
        ownerID:        row.owner_id,
        county:         row.county,
        subCounty:      row.sub_county,
        ward:           row.ward,
        status:         row.status,
        areaHectares:   row.area_hectares,
        landUseType:    row.land_use_type,
        gpsCoordinates: row.gps_coordinates,
        blockchainRef:  row.blockchain_ref,
        createdAt:      row.created_at,
        owner: {
          userID:   row.owner_user_id,
          fullName: row.owner_full_name,
          email:    row.owner_email,
        },
      },
    });

  } catch (error) {
    console.error("Parcel fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
