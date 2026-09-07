import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/http";
import { postCreateEmergencyCase, getEmergencyCaseLive } from "../../controllers/api/emergency.controller";

export const emergencyRouter = Router();

// POST /api/emergency/cases - Create emergency case (admin only)
emergencyRouter.post(
  "/cases",
  requireAuth,
  requireRole("admin"),
  asyncHandler(postCreateEmergencyCase),
);

// GET /api/emergency/cases/:id/live - Live tracker data (requireAuth)
emergencyRouter.get(
  "/cases/:id/live",
  requireAuth,
  asyncHandler(getEmergencyCaseLive),
);
