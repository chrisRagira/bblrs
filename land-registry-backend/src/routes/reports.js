import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getSummary,
  getMonthlyActivity,
  getTransferOutcomes,
  getLandUse,
  getCountyStats,
  getTransferValueByType,
  getTransferSummary,
  getRecentTransactions,
  exportReport,
} from "../controllers/reportsController.js";

const router = Router();

// All report endpoints require a valid JWT and ADMIN or REGISTRAR role
router.use(authenticate);
router.use(authorize("ADMIN", "REGISTRAR"));

/**
 * GET /api/v1/reports/summary
 * Query: ?period=2025
 * Returns: KPI totals — registrations, transfers, encumbrances, total value + YoY deltas
 */
router.get("/summary", getSummary);

/**
 * GET /api/v1/reports/monthly-activity
 * Query: ?period=2025
 * Returns: monthly counts of parcels, transfers, encumbrances (line chart data)
 */
router.get("/monthly-activity", getMonthlyActivity);

/**
 * GET /api/v1/reports/transfer-outcomes
 * Query: ?period=2025
 * Returns: monthly approved / rejected / pending counts (bar chart data)
 */
router.get("/transfer-outcomes", getTransferOutcomes);

/**
 * GET /api/v1/reports/land-use
 * Returns: parcel counts by land use type with percentages (donut chart data)
 */
router.get("/land-use", getLandUse);

/**
 * GET /api/v1/reports/county-stats
 * Query: ?period=2025
 * Returns: top counties by parcel count, transfers, value + 8-month sparkline
 */
router.get("/county-stats", getCountyStats);

/**
 * GET /api/v1/reports/transfer-value-by-type
 * Query: ?period=2025
 * Returns: total value and count per transfer type (SALE, GIFT, INHERITANCE, COURT_ORDER)
 */
router.get("/transfer-value-by-type", getTransferValueByType);

/**
 * GET /api/v1/reports/transfer-summary
 * Query: ?period=2025
 * Returns: approved / rejected / pending counts with percentages
 */
router.get("/transfer-summary", getTransferSummary);

/**
 * GET /api/v1/reports/recent-transactions
 * Query: ?type=Transfer&status=APPROVED&page=1&limit=20
 * Returns: paginated unified transaction feed (registrations + transfers + encumbrances)
 */
router.get("/recent-transactions", getRecentTransactions);

/**
 * GET /api/v1/reports/export
 * Query: ?period=2025
 * Returns: CSV file download of all transfers in the selected period
 */
router.get("/export", exportReport);

export default router;
