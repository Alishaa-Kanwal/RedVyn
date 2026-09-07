-- CreateEnum
CREATE TYPE "PublicRole" AS ENUM ('donor', 'guardian', 'hospital');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PublicRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "donorId" TEXT,
    "patientId" TEXT,
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_phoneHash_key" ON "Account"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "Account_donorId_key" ON "Account"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_patientId_key" ON "Account"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_hospitalId_key" ON "Account"("hospitalId");

-- CreateIndex
CREATE INDEX "Account_role_idx" ON "Account"("role");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
