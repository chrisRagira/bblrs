// ─── Reports Controller ───────────────────────────────────────────────────────
// Supplies all data consumed by ReportsDashboard.jsx

// ── Helper: parse period query param into date range ────────────────────────
function parsePeriod(period = "2025") {
  const now = new Date();

  if (period === "Last 30 days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to:   now.toISOString().slice(0, 10),
    };
  }

  // Quarter — "Q1 2025"
  const qMatch = period.match(/^Q([1-4])\s+(\d{4})$/);
  if (qMatch) {
    const q  = parseInt(qMatch[1]);
    const yr = parseInt(qMatch[2]);
    return {
      from: new Date(yr, (q - 1) * 3, 1).toISOString().slice(0, 10),
      to:   new Date(yr, q * 3, 0).toISOString().slice(0, 10),
    };
  }

  // Full year — "2025"
  const yrMatch = period.match(/^(\d{4})$/);
  if (yrMatch) {
    return { from: `${yrMatch[1]}-01-01`, to: `${yrMatch[1]}-12-31` };
  }

  // Fallback: current year
  const yr = now.getFullYear();
  return { from: `${yr}-01-01`, to: `${yr}-12-31` };
}

// ── GET /reports/summary ─────────────────────────────────────────────────────
// KPI cards: total registrations, transfers, encumbrances, total value
export async function getSummary(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    // Total parcel registrations in period
    const [[{ registrations }]] = await req.db.execute(
      `SELECT COUNT(*) AS registrations
       FROM parcels
       WHERE created_at BETWEEN ? AND ?`,
      [from, to + " 23:59:59"]
    );

    // Ownership transfers in period
    const [[{ transfers }]] = await req.db.execute(
      `SELECT COUNT(*) AS transfers
       FROM transfers
       WHERE created_at BETWEEN ? AND ?`,
      [from, to + " 23:59:59"]
    );

    // Active encumbrances (current snapshot, not period-filtered)
    const [[{ encumbrances }]] = await req.db.execute(
      `SELECT COUNT(*) AS encumbrances
       FROM encumbrances
       WHERE status = 'ACTIVE'`
    );

    // Total value of approved transfers in period
    const [[{ totalValue }]] = await req.db.execute(
      `SELECT COALESCE(SUM(sale_price_kes), 0) AS totalValue
       FROM transfers
       WHERE status = 'APPROVED'
         AND created_at BETWEEN ? AND ?`,
      [from, to + " 23:59:59"]
    );

    // Same stats for previous period (for YoY delta)
    const prevFrom = new Date(from);
    const prevTo   = new Date(to);
    prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    prevTo.setFullYear(prevTo.getFullYear() - 1);
    const pf = prevFrom.toISOString().slice(0, 10);
    const pt = prevTo.toISOString().slice(0, 10);

    const [[{ prevRegistrations }]] = await req.db.execute(
      `SELECT COUNT(*) AS prevRegistrations FROM parcels
       WHERE created_at BETWEEN ? AND ?`,
      [pf, pt + " 23:59:59"]
    );

    const [[{ prevTransfers }]] = await req.db.execute(
      `SELECT COUNT(*) AS prevTransfers FROM transfers
       WHERE created_at BETWEEN ? AND ?`,
      [pf, pt + " 23:59:59"]
    );

    const [[{ prevValue }]] = await req.db.execute(
      `SELECT COALESCE(SUM(sale_price_kes), 0) AS prevValue
       FROM transfers
       WHERE status = 'APPROVED'
         AND created_at BETWEEN ? AND ?`,
      [pf, pt + " 23:59:59"]
    );

    const delta = (curr, prev) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;

    return res.json({
      data: {
        registrations:  { value: registrations, delta: delta(registrations, prevRegistrations) },
        transfers:      { value: transfers,      delta: delta(transfers,      prevTransfers)      },
        encumbrances:   { value: encumbrances,   delta: 0 },
        totalValueKES:  { value: totalValue,      delta: delta(totalValue, prevValue) },
      },
    });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ message: "Failed to load summary." });
  }
}

// ── GET /reports/monthly-activity ────────────────────────────────────────────
// Line chart: parcels, transfers, encumbrances per month
export async function getMonthlyActivity(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    const [parcelRows] = await req.db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month,
              MONTH(created_at)             AS month_num,
              COUNT(*)                      AS count
       FROM parcels
       WHERE created_at BETWEEN ? AND ?
       GROUP BY month_num, month
       ORDER BY month_num`,
      [from, to + " 23:59:59"]
    );

    const [transferRows] = await req.db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month,
              MONTH(created_at)             AS month_num,
              COUNT(*)                      AS count
       FROM transfers
       WHERE created_at BETWEEN ? AND ?
       GROUP BY month_num, month
       ORDER BY month_num`,
      [from, to + " 23:59:59"]
    );

    const [encRows] = await req.db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month,
              MONTH(created_at)             AS month_num,
              COUNT(*)                      AS count
       FROM encumbrances
       WHERE created_at BETWEEN ? AND ?
       GROUP BY month_num, month
       ORDER BY month_num`,
      [from, to + " 23:59:59"]
    );

    // Merge into unified array keyed by month_num 1-12
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const toMap  = (rows) => Object.fromEntries(rows.map(r => [r.month_num, r.count]));

    const pMap = toMap(parcelRows);
    const tMap = toMap(transferRows);
    const eMap = toMap(encRows);

    const data = months.map((month, i) => ({
      month,
      parcels:       pMap[i + 1] || 0,
      transfers:     tMap[i + 1] || 0,
      encumbrances:  eMap[i + 1] || 0,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("getMonthlyActivity error:", err);
    res.status(500).json({ message: "Failed to load monthly activity." });
  }
}

// ── GET /reports/transfer-outcomes ───────────────────────────────────────────
// Bar chart: approved vs rejected per month
export async function getTransferOutcomes(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    const [rows] = await req.db.execute(
      `SELECT DATE_FORMAT(created_at, '%b') AS month,
              MONTH(created_at)             AS month_num,
              status,
              COUNT(*)                      AS count
       FROM transfers
       WHERE created_at BETWEEN ? AND ?
         AND status IN ('APPROVED','REJECTED','PENDING')
       GROUP BY month_num, month, status
       ORDER BY month_num`,
      [from, to + " 23:59:59"]
    );

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Build a map: { month_num: { approved, rejected, pending } }
    const map = {};
    rows.forEach(r => {
      if (!map[r.month_num]) map[r.month_num] = { approved: 0, rejected: 0, pending: 0 };
      map[r.month_num][r.status.toLowerCase()] = r.count;
    });

    const data = months.map((month, i) => ({
      month,
      approved: map[i + 1]?.approved || 0,
      rejected: map[i + 1]?.rejected || 0,
      pending:  map[i + 1]?.pending  || 0,
    }));

    return res.json({ data });
  } catch (err) {
    console.error("getTransferOutcomes error:", err);
    res.status(500).json({ message: "Failed to load transfer outcomes." });
  }
}

// ── GET /reports/land-use ────────────────────────────────────────────────────
// Donut chart: parcel count by land use type
export async function getLandUse(req, res) {
  try {
    const [rows] = await req.db.execute(
      `SELECT land_use_type AS type,
              COUNT(*)      AS count
       FROM parcels
       WHERE status != 'INACTIVE'
       GROUP BY land_use_type
       ORDER BY count DESC`
    );

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    const COLORS = {
      RESIDENTIAL:  "#0D7A6F",
      AGRICULTURAL: "#C28A1A",
      COMMERCIAL:   "#1A3558",
      INDUSTRIAL:   "#E05C3A",
    };

    const data = rows.map(r => ({
      type:  r.type,
      count: r.count,
      pct:   total > 0 ? Math.round((r.count / total) * 100) : 0,
      color: COLORS[r.type] || "#64748B",
    }));

    return res.json({ data, total });
  } catch (err) {
    console.error("getLandUse error:", err);
    res.status(500).json({ message: "Failed to load land use data." });
  }
}

// ── GET /reports/county-stats ─────────────────────────────────────────────────
// County performance table with sparklines
export async function getCountyStats(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    // Aggregate parcels + transfers per county
    const [rows] = await req.db.execute(
      `SELECT
         p.county,
         COUNT(DISTINCT p.parcel_id)                                      AS parcels,
         COUNT(DISTINCT t.transfer_id)                                    AS transfers,
         COALESCE(SUM(CASE WHEN t.status='APPROVED' THEN t.sale_price_kes ELSE 0 END), 0) AS total_value_kes
       FROM parcels p
       LEFT JOIN transfers t
         ON t.parcel_id = p.parcel_id
         AND t.created_at BETWEEN ? AND ?
       WHERE p.created_at BETWEEN ? AND ?
       GROUP BY p.county
       ORDER BY parcels DESC
       LIMIT 10`,
      [from, to + " 23:59:59", from, to + " 23:59:59"]
    );

    // Monthly sparkline (last 8 months) per county
    const [sparkRows] = await req.db.execute(
      `SELECT
         county,
         MONTH(created_at)  AS month_num,
         COUNT(*)           AS count
       FROM parcels
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 8 MONTH)
       GROUP BY county, month_num
       ORDER BY county, month_num`
    );

    // Build sparkline map: { county: [count, count, ...] }
    const sparkMap = {};
    sparkRows.forEach(r => {
      if (!sparkMap[r.county]) sparkMap[r.county] = [];
      sparkMap[r.county].push(r.count);
    });

    const data = rows.map(r => ({
      county:        r.county,
      parcels:       r.parcels,
      transfers:     r.transfers,
      totalValueKES: r.total_value_kes,
      sparkline:     sparkMap[r.county] || [0],
    }));

    return res.json({ data });
  } catch (err) {
    console.error("getCountyStats error:", err);
    res.status(500).json({ message: "Failed to load county stats." });
  }
}

// ── GET /reports/transfer-value-by-type ──────────────────────────────────────
// Breakdown of transfer value by type (SALE, GIFT, INHERITANCE, COURT_ORDER)
export async function getTransferValueByType(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    const [rows] = await req.db.execute(
      `SELECT
         transfer_type                        AS type,
         COUNT(*)                             AS count,
         COALESCE(SUM(sale_price_kes), 0)     AS total_value_kes
       FROM transfers
       WHERE status = 'APPROVED'
         AND created_at BETWEEN ? AND ?
       GROUP BY transfer_type
       ORDER BY total_value_kes DESC`,
      [from, to + " 23:59:59"]
    );

    const grandTotal = rows.reduce((s, r) => s + Number(r.total_value_kes), 0);

    const data = rows.map(r => ({
      type:          r.type,
      count:         r.count,
      totalValueKES: Number(r.total_value_kes),
      pct:           grandTotal > 0
        ? Math.round((r.total_value_kes / grandTotal) * 100)
        : 0,
    }));

    return res.json({ data, grandTotalKES: grandTotal });
  } catch (err) {
    console.error("getTransferValueByType error:", err);
    res.status(500).json({ message: "Failed to load transfer value data." });
  }
}

// ── GET /reports/transfer-summary ────────────────────────────────────────────
// Approved / Rejected / Pending counts + percentages
export async function getTransferSummary(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    const [rows] = await req.db.execute(
      `SELECT status, COUNT(*) AS count
       FROM transfers
       WHERE created_at BETWEEN ? AND ?
       GROUP BY status`,
      [from, to + " 23:59:59"]
    );

    const map   = Object.fromEntries(rows.map(r => [r.status, r.count]));
    const total = rows.reduce((s, r) => s + r.count, 0);

    const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return res.json({
      data: {
        approved: { count: map.APPROVED || 0, pct: pct(map.APPROVED || 0) },
        rejected: { count: map.REJECTED || 0, pct: pct(map.REJECTED || 0) },
        pending:  { count: map.PENDING  || 0, pct: pct(map.PENDING  || 0) },
        total,
      },
    });
  } catch (err) {
    console.error("getTransferSummary error:", err);
    res.status(500).json({ message: "Failed to load transfer summary." });
  }
}

// ── GET /reports/recent-transactions ─────────────────────────────────────────
// Transaction feed for the bottom table
export async function getRecentTransactions(req, res) {
  const { type, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params     = [];

  if (type && type !== "ALL") {
    conditions.push(`tx_type = ?`);
    params.push(type);
  }
  if (status && status !== "ALL") {
    conditions.push(`tx_status = ?`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    // Unified view across parcels, transfers, encumbrances
    // Uses a UNION so the feed shows all activity types together
    const baseQuery = `
      SELECT
        CONCAT('REG-', p.parcel_id)   AS tx_id,
        'Registration'                AS tx_type,
        p.title_number                AS parcel,
        p.county,
        0                             AS value_kes,
        'APPROVED'                    AS tx_status,
        p.created_at                  AS tx_date
      FROM parcels p

      UNION ALL

      SELECT
        CONCAT('TX-', t.transfer_id)  AS tx_id,
        'Transfer'                    AS tx_type,
        p.title_number                AS parcel,
        p.county,
        t.sale_price_kes              AS value_kes,
        t.status                      AS tx_status,
        t.created_at                  AS tx_date
      FROM transfers t
      JOIN parcels p ON p.parcel_id = t.parcel_id

      UNION ALL

      SELECT
        CONCAT('EN-', e.encumbrance_id) AS tx_id,
        'Encumbrance'                   AS tx_type,
        p.title_number                  AS parcel,
        p.county,
        e.amount_kes                    AS value_kes,
        e.status                        AS tx_status,
        e.created_at                    AS tx_date
      FROM encumbrances e
      JOIN parcels p ON p.parcel_id = e.parcel_id
    `;

    const [[{ total }]] = await req.db.execute(
      `SELECT COUNT(*) AS total FROM (${baseQuery}) AS unified ${where}`,
      params
    );

    const [rows] = await req.db.execute(
      `SELECT * FROM (${baseQuery}) AS unified
       ${where}
       ORDER BY tx_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const data = rows.map(r => ({
      id:       r.tx_id,
      type:     r.tx_type,
      parcel:   r.parcel,
      county:   r.county,
      valueKES: Number(r.value_kes),
      status:   r.tx_status,
      date:     r.tx_date?.toISOString?.().slice(0, 10) ?? r.tx_date,
    }));

    return res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("getRecentTransactions error:", err);
    res.status(500).json({ message: "Failed to load transactions." });
  }
}

// ── GET /reports/export ───────────────────────────────────────────────────────
// Returns a CSV of all transactions for the selected period
export async function exportReport(req, res) {
  const { from, to } = parsePeriod(req.query.period);

  try {
    const [rows] = await req.db.execute(
      `SELECT
         t.transfer_id,
         p.title_number,
         p.county,
         p.land_use_type,
         t.transfer_type,
         t.sale_price_kes,
         t.status,
         u_from.full_name  AS seller,
         u_to.full_name    AS buyer,
         t.created_at
       FROM transfers t
       JOIN parcels p        ON p.parcel_id   = t.parcel_id
       JOIN users   u_from   ON u_from.user_id = t.previous_owner_id
       JOIN users   u_to     ON u_to.user_id   = t.new_owner_id
       WHERE t.created_at BETWEEN ? AND ?
       ORDER BY t.created_at DESC`,
      [from, to + " 23:59:59"]
    );

    const header = "Transfer ID,Title Number,County,Land Use,Transfer Type,Sale Price (KES),Status,Seller,Buyer,Date\n";
    const csv    = rows.map(r =>
      [
        r.transfer_id,
        r.title_number,
        r.county,
        r.land_use_type,
        r.transfer_type,
        r.sale_price_kes,
        r.status,
        `"${r.seller}"`,
        `"${r.buyer}"`,
        r.created_at?.toISOString?.().slice(0, 10) ?? r.created_at,
      ].join(",")
    ).join("\n");

    res.setHeader("Content-Type",        "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="bblrs-report-${from}-${to}.csv"`);
    return res.send(header + csv);
  } catch (err) {
    console.error("exportReport error:", err);
    res.status(500).json({ message: "Export failed." });
  }
}
