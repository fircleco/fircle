-- AddDomainVerificationToken
ALTER TABLE "Domain" ADD COLUMN "verificationToken" TEXT NOT NULL DEFAULT '';
