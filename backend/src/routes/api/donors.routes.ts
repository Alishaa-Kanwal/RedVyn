import { Router } from "express";
import * as c from "../../controllers/api/donors.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

/** JSON API for the donor registry. */
export const donorsRouter = Router();

donorsRouter.use(requireAuth);

// Admin-only list; detail is role-scoped.
// Admin sees the whole registry; a hospital sees only donors tied to its own cases.
donorsRouter.get("/", requireRole("admin", "hospital"), c.listDonors);
donorsRouter.get("/me/history", requireRole("donor"), c.getDonorHistory);
// The donor's own request inbox, and answering one from the dashboard.
donorsRouter.get("/me/offers", requireRole("donor"), c.getMyOffers);
donorsRouter.post(
  "/me/offers/:id/respond",
  requireRole("donor"),
  validate(c.offerResponseSchema),
  c.respondToMyOffer,
);
donorsRouter.get("/:id", c.getDonor);
donorsRouter.post("/", requireRole("admin"), validate(c.donorSchema), c.createDonor);
donorsRouter.patch("/:id/status", requireRole("admin"), validate(c.donorStatusSchema), c.updateDonorStatus);
donorsRouter.post("/:id/reveal-phone", requireRole("admin"), c.revealDonorPhone);
