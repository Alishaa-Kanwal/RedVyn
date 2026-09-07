import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is not set — see .env.example");

// Prisma 7 is rust-free: the client needs a driver adapter, there is no query engine.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
