import { Router } from "express";
import * as c from "../../controllers/api/dashboard.controller";
import { requireAuth, requireRole } from "../../middleware/auth";

/** Dashboard aggregate endpoint for the Overview page. */
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("admin"));
dashboardRouter.get("/overview", c.getOverview);
