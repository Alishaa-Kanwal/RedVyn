import { Router } from "express";
import * as c from "../../controllers/api/cases.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

/** JSON API for the case lifecycle. */
export const casesRouter = Router();

casesRouter.use(requireAuth);

// Case lists/details are role-scoped in the controller.
casesRouter.get("/", c.listCases);
casesRouter.get("/pending-review", requireRole("admin"), c.pendingReview);
// Dry-run the lineup before committing. Scoped to the caller in the controller.
casesRouter.get("/match-preview", requireRole("admin", "hospital", "guardian"), c.matchPreview);
casesRouter.get("/:id", c.getCaseDetail);
casesRouter.get("/:id/timeline", c.getTimeline);

// Hospitals and guardians raise their own cases; the controller pins the case to the
// caller's own hospital / linked patient, so the body cannot name someone else's.
casesRouter.post(
  "/",
  requireRole("admin", "hospital", "guardian"),
  validate(c.createCaseSchema),
  c.createCase,
);
casesRouter.post("/:id/promote", requireRole("admin"), c.promoteStandby);
// The requester side closes the case by typing back the donor's code. Donor is barred
// in the controller: confirming your own donation would farm reliability score.
casesRouter.post(
  "/:id/confirm",
  requireRole("admin", "hospital", "guardian"),
  validate(c.confirmDonationSchema),
  c.confirmDonation,
);
