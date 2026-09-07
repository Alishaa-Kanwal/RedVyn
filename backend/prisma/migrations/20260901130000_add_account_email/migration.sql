-- Allow public accounts to use the same email address for sign-in as an alternative to phone.
ALTER TABLE "Account" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
