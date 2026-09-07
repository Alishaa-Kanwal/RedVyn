import { Router } from "express";
import * as c from "../controllers/public.controller";
import { validate } from "../middleware/validate";

/** Token-addressed, no session. The token in the URL is the authentication. */
export const publicRouter = Router();

publicRouter.get("/offer/:token", c.getOffer);
publicRouter.post("/offer/:token/accept", c.postAccept);
publicRouter.post("/offer/:token/decline", validate(c.declineSchema), c.postDecline);

publicRouter.get("/me/:token", c.getManage);
publicRouter.post("/me/:token/opt-out", c.postOptOut);

publicRouter.get("/case/:token", c.getFamily);
publicRouter.post("/case/:token/confirm", validate(c.confirmSchema), c.postConfirm);
