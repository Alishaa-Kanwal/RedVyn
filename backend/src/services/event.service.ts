import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db";

type Ids = { caseId?: string; offerId?: string; donorId?: string; userId?: string };
type Payload = Record<string, string | number | boolean | null>;

export type AuditLogFilters = {
  type?: string;
  from?: string;
  to?: string;
  caseId?: string;
  donorId?: string;
  userId?: string;
  page: number;
  pageSize: number;
};

/**
 * Append-only audit log (§5.5). Doubles as the event bus of §4.1, so the rules are
 * the bus's rules: ids only, never PII in `payload`.
 *
 * Awaited on purpose. Prisma promises are lazy — a fire-and-forget `void
 * prisma.event.create(...)` is never executed at all, which silently empties the
 * audit trail. §5.5 makes reconstructing what happened non-optional, so callers pay
 * the round trip.
 */
export async function logEvent(type: string, ids: Ids = {}, payload: Payload = {}): Promise<void> {
  await prisma.event.create({ data: { type, ...ids, payload } });
}

function buildAuditWhere(filters: Omit<AuditLogFilters, "page" | "pageSize">): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};
  if (filters.type) where.type = { contains: filters.type, mode: "insensitive" };
  if (filters.caseId) where.caseId = filters.caseId;
  if (filters.donorId) where.donorId = filters.donorId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.from || filters.to) {
    where.at = {};
    if (filters.from) where.at.gte = new Date(filters.from);
    if (filters.to) where.at.lt = new Date(filters.to);
  }
  return where;
}

/**
 * §5.5 Paginated read view over the append-only Event table.
 * Returns ids only, never PII, consistent with Event's design.
 */
export async function listAuditLog(filters: AuditLogFilters) {
  const { page, pageSize, ...rest } = filters;
  const where = buildAuditWhere(rest);
  const [data, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ]);
  return { data, total };
}
