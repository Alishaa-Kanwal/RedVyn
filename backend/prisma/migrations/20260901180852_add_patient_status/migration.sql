-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('active', 'paused', 'opted_out', 'blocked');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'active';
