import type { Request, Response } from "express";
import { getDashboardOverview } from "../../services/dashboard.service";

export async function getOverview(_req: Request, res: Response): Promise<void> {
  res.json(await getDashboardOverview());
}
