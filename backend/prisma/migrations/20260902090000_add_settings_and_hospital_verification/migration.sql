-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "orgName" TEXT NOT NULL,
    "orgTagline" TEXT NOT NULL,
    "primaryContact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "dateFormat" TEXT NOT NULL,
    "timeFormat" TEXT NOT NULL,
    "itemsPerPage" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "newEmergencyCase" BOOLEAN NOT NULL DEFAULT true,
    "donorConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "missedCalls" BOOLEAN NOT NULL DEFAULT true,
    "caseEscalation" BOOLEAN NOT NULL DEFAULT true,
    "dailySummary" BOOLEAN NOT NULL DEFAULT false,
    "autoLogoutMinutes" INTEGER NOT NULL DEFAULT 30,
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
