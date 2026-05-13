-- Add member identity fields
ALTER TABLE "FamilyMember"
ADD COLUMN "nickname" TEXT,
ADD COLUMN "slug" TEXT;

-- Backfill missing names before enforcing NOT NULL
UPDATE "FamilyMember"
SET "name" = COALESCE(
  NULLIF(BTRIM("name"), ''),
  'member-' || RIGHT("id", 6)
)
WHERE "name" IS NULL OR BTRIM("name") = '';

-- Build deterministic, URL-safe slugs from current names and de-duplicate within family
WITH prepared AS (
  SELECT
    fm."id",
    fm."familyId",
    COALESCE(
      NULLIF(
        BTRIM(
          REGEXP_REPLACE(
            LOWER(REGEXP_REPLACE(fm."name", '[^a-zA-Z0-9]+', '-', 'g')),
            '(^-+|-+$)',
            '',
            'g'
          )
        ),
        ''
      ),
      'member-' || RIGHT(fm."id", 6)
    ) AS base_slug
  FROM "FamilyMember" fm
), ranked AS (
  SELECT
    p."id",
    p.base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY p."familyId", p.base_slug
      ORDER BY p."id"
    ) AS slug_rank
  FROM prepared p
)
UPDATE "FamilyMember" fm
SET "slug" = CASE
  WHEN ranked.slug_rank = 1 THEN ranked.base_slug
  ELSE ranked.base_slug || '-' || ranked.slug_rank::TEXT
END
FROM ranked
WHERE ranked."id" = fm."id";

-- Enforce required fields and uniqueness guarantees
ALTER TABLE "FamilyMember"
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "FamilyMember_familyId_slug_key" ON "FamilyMember"("familyId", "slug");
