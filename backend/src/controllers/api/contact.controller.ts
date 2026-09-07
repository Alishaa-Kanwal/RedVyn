import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";

/**
 * Public contact form submissions from the marketing site.
 */

export const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().min(1).email().max(254),
  message: z.string().min(1).max(5000),
});

export async function postContact(req: Request, res: Response): Promise<void> {
  const { name, email, message } = req.body;
  const entry = await prisma.contactMessage.create({
    data: { name, email: email.toLowerCase(), message },
  });
  res.status(201).json({ id: entry.id });
}
