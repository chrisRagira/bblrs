import { Router } from "express";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getSummary,
  getMonthlyActivity,
  getTransferOutcomes,
  getLandUse,
  getCountyStats,
  getTransferValueByType,
  getTransferSummary,
  getRecentTransactions,
  // getDisputeStats,
  // getComplianceMetrics,
  exportReport,
} from "../controllers/reportsController.js";

const router = Router();

router.use(verifyToken);
router.use(authorizeRoles("ADMIN", "REGISTRAR"));

router.get("/summary",               getSummary);
router.get("/monthly-activity",      getMonthlyActivity);
router.get("/transfer-outcomes",     getTransferOutcomes);
router.get("/land-use",              getLandUse);
router.get("/county-stats",          getCountyStats);
router.get("/transfer-value-by-type",getTransferValueByType);
router.get("/transfer-summary",      getTransferSummary);
router.get("/recent-transactions",   getRecentTransactions);
// router.get("/dispute-stats",         getDisputeStats);      // NEW
// router.get("/compliance-metrics",    getComplianceMetrics); // NEW
router.get("/export",                exportReport);

export default router;