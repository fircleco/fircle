ALTER TABLE "Family" ADD COLUMN "slug" TEXT;

WITH normalized AS (
  SELECT
    "id",
    base_slug,
    row_number() OVER (
      PARTITION BY base_slug
      ORDER BY "createdAt", "id"
    ) AS slug_rank
  FROM (
    SELECT
      "id",
      "createdAt",
      COALESCE(
        NULLIF(
        regexp_replace(
          regexp_replace(lower(coalesce("name", '')), '[^a-z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        ),
          ''
        ),
        'family'
      ) AS base_slug
    FROM "Family"
  ) source_rows
)
UPDATE "Family" family
SET "slug" = CASE
  WHEN normalized.slug_rank = 1 THEN normalized.base_slug
  ELSE normalized.base_slug || '-' || normalized.slug_rank::text
END
FROM normalized
WHERE family."id" = normalized."id";

ALTER TABLE "Family" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Family_slug_key" ON "Family"("slug");

CREATE TABLE "Domain" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Domain_domain_key" ON "Domain"("domain");
CREATE INDEX "Domain_familyId_idx" ON "Domain"("familyId");
CREATE INDEX "Domain_familyId_isPrimary_idx" ON "Domain"("familyId", "isPrimary");
CREATE UNIQUE INDEX "Domain_familyId_primary_key" ON "Domain"("familyId") WHERE "isPrimary";

ALTER TABLE "Domain"
ADD CONSTRAINT "Domain_familyId_fkey"
FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Domain" ("id", "familyId", "domain", "isPrimary", "verifiedAt", "createdAt", "updatedAt")
SELECT
  "Family"."id" || '-default-domain',
  "Family"."id",
  "Family"."slug" || '.fircle.app',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Family"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Domain"
  WHERE "Domain"."domain" = "Family"."slug" || '.fircle.app'
);