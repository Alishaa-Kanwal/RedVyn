import { Router } from "express";
import * as c from "../../controllers/api/contact.controller";
import { validate } from "../../middleware/validate";

/** Public contact form endpoint. */
export const contactRouter = Router();

contactRouter.post("/", validate(c.contactSchema), c.postContact);
