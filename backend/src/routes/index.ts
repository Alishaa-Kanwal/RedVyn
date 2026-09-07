import { Router } from "express";
import { auditRouter } from "./api/audit.routes";
import { authRouter } from "./api/auth.routes";
import { casesRouter } from "./api/cases.routes";
import { contactRouter } from "./api/contact.routes";
import { dashboardRouter } from "./api/dashboard.routes";
import { donorsRouter } from "./api/donors.routes";
import { emergencyRouter } from "./api/emergency.routes";
import { hospitalsRouter } from "./api/hospitals.routes";
import { patientsRouter } from "./api/patients.routes";
import { publicRouter } from "./public.routes";
import { settingsRouter } from "./api/settings.routes";
export const router = Router();
const frontendUrl = (process.env["FRONTEND_URL"] ?? "http://localhost:3000").replace(/\/$/, "");

router.get("/", (_req, res) => res.json({ service: "RedVyn API" }));
// Friendly entry URLs. The browser is sent to the Next.js pages; credentials are
// still submitted to this backend through /api/auth/*.
router.get("/login", (_req, res) => res.redirect(`${frontendUrl}/login`));
router.get("/signup", (_req, res) => res.redirect(`${frontendUrl}/signup`));
router.use("/api/auth", authRouter);
router.use("/api/donors", donorsRouter);
router.use("/api/patients", patientsRouter);
router.use("/api/hospitals", hospitalsRouter);
router.use("/api/cases", casesRouter);
router.use("/api/contact", contactRouter);
router.use("/api/dashboard", dashboardRouter);
router.use("/api/emergency", emergencyRouter);
router.use("/api/audit-log", auditRouter);
router.use("/api/settings", settingsRouter);
// Token-addressed SMS magic links: the donor offer reply and the family confirmation
// that closes a case. Unauthenticated by design — the token is the credential.
router.use(publicRouter);
