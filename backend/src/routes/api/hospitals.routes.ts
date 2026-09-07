import { Router } from "express";
import * as c from "../../controllers/api/hospitals.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

/** JSON API for hospital records. GET /public is open for signup; everything else is admin-only. */
export const hospitalsRouter = Router();

hospitalsRouter.get("/public", c.getPublicHospitals);

hospitalsRouter.use(requireAuth);

// Admin-only list; detail is role-scoped (admin or own hospital).
hospitalsRouter.get("/", requireRole("admin"), c.listHospitalsHandler);
hospitalsRouter.get("/:id", c.getHospital);
hospitalsRouter.post("/", requireRole("admin"), validate(c.hospitalSchema), c.createHospital);
hospitalsRouter.patch("/:id", requireRole("admin"), validate(c.hospitalUpdateSchema), c.updateHospital);
hospitalsRouter.patch("/:id/verify", requireRole("admin"), validate(c.hospitalVerifySchema), c.verifyHospital);
