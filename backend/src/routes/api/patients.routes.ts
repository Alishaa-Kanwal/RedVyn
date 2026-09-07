import { Router } from "express";
import * as c from "../../controllers/api/patients.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

/** JSON API for the patient registry. */
export const patientsRouter = Router();

patientsRouter.use(requireAuth);

// Admin-only list; detail is role-scoped (admin or linked guardian).
patientsRouter.get("/", requireRole("admin", "hospital", "guardian"), c.listPatients);
patientsRouter.get("/me", requireRole("admin", "guardian", "hospital"), c.getMyPatients);
patientsRouter.get("/:id", c.getPatient);
patientsRouter.post("/", requireRole("admin"), validate(c.patientSchema), c.createPatient);
patientsRouter.patch("/:id/status", requireRole("admin"), validate(c.patientStatusSchema), c.updatePatientStatus);
patientsRouter.post("/:id/reveal-guardian-phone", requireRole("admin"), c.revealGuardianPhone);
