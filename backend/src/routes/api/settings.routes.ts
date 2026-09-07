import { Router } from "express";
import * as c from "../../controllers/api/settings.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

export const settingsRouter = Router();
settingsRouter.get("/", requireAuth, requireRole("admin"), c.getSettings);
settingsRouter.patch("/", requireAuth, requireRole("admin"), validate(c.systemSettingsSchema), c.patchSettings);
settingsRouter.get("/preferences", requireAuth, c.getPreferences);
settingsRouter.patch("/preferences", requireAuth, validate(c.preferenceSchema), c.patchPreferences);
