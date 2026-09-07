import { Router } from "express";
import * as c from "../../controllers/api/auth.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

/** API auth routes. */
export const authRouter = Router();

// Unified legacy endpoints (kept for the public marketing site forms).
authRouter.post("/login", validate(c.loginSchema), c.postLogin);
authRouter.post("/signin", c.postSignin);
authRouter.post("/signup", c.postSignup);
authRouter.post("/logout", c.postLogout);
authRouter.get("/me", requireAuth, c.getMe);

// Self-service profile: what the signed-in account may change about itself.
authRouter.get("/profile", requireAuth, c.getProfileHandler);
authRouter.patch("/profile", requireAuth, c.patchProfileHandler);

// Role-specific registration / claim endpoints.
authRouter.post("/donor/register", validate(c.donorRegisterSchema), c.postDonorRegister);
authRouter.post("/donor/login", c.postDonorLogin);
authRouter.post("/guardian/register", validate(c.guardianRegisterSchema), c.postGuardianRegister);
authRouter.post("/guardian/login", c.postGuardianLogin);
authRouter.post("/hospital/register", validate(c.hospitalRegisterSchema), c.postHospitalRegister);
authRouter.post("/hospital/login", c.postHospitalLogin);

// Admin user management.
authRouter.get("/admin/users", requireAuth, requireRole("admin"), c.getAdminUsers);
authRouter.post("/admin/users", requireAuth, requireRole("admin"), validate(c.createAdminUserSchema), c.postAdminUser);
authRouter.patch("/admin/users/:id/status", requireAuth, requireRole("admin"), validate(c.updateAdminUserStatusSchema), c.patchAdminUserStatus);

// Role gate introspection.
authRouter.get("/roles", c.getRoles);
