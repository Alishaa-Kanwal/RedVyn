import type { Request, Response } from "express";
import { z } from "zod";
import { listAuditLog } from "../../services/event.service";

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  caseId: z.string().optional(),
  donorId: z.string().optional(),
  userId: z.string().optional(),
});

export async function getAuditLog(req: Request, res: Response): Promise<void> {
  const parsed = auditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: `${first?.path.join(".") ?? "query"}: ${first?.message}` });
    return;
  }

  const { page, pageSize, ...filters } = parsed.data;
  const { data, total } = await listAuditLog({ page, pageSize, ...filters });
  res.json({ data, pagination: { page, pageSize, total } });
}
