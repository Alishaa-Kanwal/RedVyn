-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('active', 'paused', 'opted_out', 'blocked');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ur', 'en');

-- CreateEnum
CREATE TYPE "PatientCondition" AS ENUM ('thalassemia_major', 'other');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('scheduled', 'emergency');

-- CreateEnum
CREATE TYPE "CaseState" AS ENUM ('draft', 'matching', 'awaiting_response', 'partially_filled', 'filled', 'in_progress', 'confirmed', 'closed', 'pending_review', 'escalating', 'broadcasting', 'fallback_bloodbank', 'unfilled');

-- CreateEnum
CREATE TYPE "OfferRole" AS ENUM ('primary', 'standby_1', 'standby_2');

-- CreateEnum
CREATE TYPE "OfferState" AS ENUM ('pending', 'accepted', 'code_issued', 'completed', 'no_show', 'declined', 'timed_out', 'released', 'promoted');

-- CreateEnum
CREATE TYPE "ConfirmedBy" AS ENUM ('family', 'ops');

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "deskInfo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "city" TEXT NOT NULL,
    "lastDonationAt" TIMESTAMP(3),
    "nextEligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reliabilityScore" INTEGER NOT NULL DEFAULT 50,
    "status" "DonorStatus" NOT NULL DEFAULT 'active',
    "language" "Language" NOT NULL DEFAULT 'ur',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "manageToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "guardianPhoneHash" TEXT NOT NULL,
    "guardianPhoneEnc" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "condition" "PatientCondition" NOT NULL DEFAULT 'thalassemia_major',
    "homeHospitalId" TEXT NOT NULL,
    "intervalDaysEstimate" INTEGER NOT NULL DEFAULT 21,
    "lastTransfusionAt" TIMESTAMP(3),
    "predictedNextAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "type" "CaseType" NOT NULL DEFAULT 'scheduled',
    "bloodGroup" "BloodGroup" NOT NULL,
    "unitsRequired" INTEGER NOT NULL DEFAULT 1,
    "unitsSecured" INTEGER NOT NULL DEFAULT 0,
    "slotsRemaining" INTEGER NOT NULL,
    "state" "CaseState" NOT NULL DEFAULT 'draft',
    "neededAt" TIMESTAMP(3) NOT NULL,
    "window" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "familyToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "role" "OfferRole" NOT NULL,
    "state" "OfferState" NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "code" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" "ConfirmedBy" NOT NULL DEFAULT 'family',

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "caseId" TEXT,
    "offerId" TEXT,
    "donorId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donor_phoneHash_key" ON "Donor"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_manageToken_key" ON "Donor"("manageToken");

-- CreateIndex
CREATE INDEX "Donor_status_bloodGroup_nextEligibleAt_idx" ON "Donor"("status", "bloodGroup", "nextEligibleAt");

-- CreateIndex
CREATE UNIQUE INDEX "Case_familyToken_key" ON "Case"("familyToken");

-- CreateIndex
CREATE INDEX "Case_state_idx" ON "Case"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_token_key" ON "Offer"("token");

-- CreateIndex
CREATE INDEX "Offer_donorId_state_idx" ON "Offer"("donorId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_caseId_donorId_key" ON "Offer"("caseId", "donorId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_caseId_donorId_key" ON "Donation"("caseId", "donorId");

-- CreateIndex
CREATE INDEX "Event_at_idx" ON "Event"("at");

-- CreateIndex
CREATE INDEX "Event_caseId_idx" ON "Event"("caseId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_homeHospitalId_fkey" FOREIGN KEY ("homeHospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
