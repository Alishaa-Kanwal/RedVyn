import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/http";
import { getAuditLog } from "../../controllers/api/audit.controller";

/** §5.5 Admin-only audit log read view. */
export const auditRouter = Router();

auditRouter.get("/", requireAuth, requireRole("admin"), asyncHandler(getAuditLog));
