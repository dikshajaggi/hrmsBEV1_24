import { Router } from "express";
import { fetchAuditLogs } from "./audit_logs_controllers";
import { authenticate } from "../middlewares/authenticate";
const router = Router();

router.get("/audit-logs", authenticate, fetchAuditLogs);

export default router;
