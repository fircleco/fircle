-- CreateTable
CREATE TABLE "Ffeature" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ffeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ffeature_familyId_idx" ON "Ffeature"("familyId");

-- CreateIndex
CREATE INDEX "Ffeature_featureKey_idx" ON "Ffeature"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "Ffeature_familyId_featureKey_key" ON "Ffeature"("familyId", "featureKey");

-- AddForeignKey
ALTER TABLE "Ffeature" ADD CONSTRAINT "Ffeature_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
