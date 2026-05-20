-- CreateTable
CREATE TABLE "public"."WebsiteDesignConcept" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "metadata" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "generatorSeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDesignConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteDesignConcept_websiteId_slug_key" ON "public"."WebsiteDesignConcept"("websiteId", "slug");

-- CreateIndex
CREATE INDEX "WebsiteDesignConcept_websiteId_position_idx" ON "public"."WebsiteDesignConcept"("websiteId", "position");

-- AlterTable
ALTER TABLE "public"."WebsiteDesignSystem"
  ADD COLUMN "designConceptId" TEXT,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;

-- Seed a default concept per website and link existing design systems
WITH inserted_concepts AS (
  INSERT INTO "public"."WebsiteDesignConcept" ("id", "websiteId", "name", "slug", "position", "isDefault", "createdAt", "updatedAt")
  SELECT
    concat('concept_', w."id"),
    w."id",
    'Design Concept 1',
    'design-concept-1',
    0,
    true,
    NOW(),
    NOW()
  FROM "public"."Website" w
  ON CONFLICT ("websiteId", "slug") DO NOTHING
  RETURNING "websiteId", "id"
),
default_concepts AS (
  SELECT "websiteId", "id" FROM inserted_concepts
  UNION
  SELECT "websiteId", "id" FROM "public"."WebsiteDesignConcept" WHERE "slug" = 'design-concept-1'
)
UPDATE "public"."WebsiteDesignSystem" ds
SET "designConceptId" = dc."id"
FROM default_concepts dc
WHERE ds."websiteId" = dc."websiteId" AND ds."designConceptId" IS NULL;

-- Ensure new column is required
ALTER TABLE "public"."WebsiteDesignSystem"
  ALTER COLUMN "designConceptId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."WebsiteDesignConcept"
  ADD CONSTRAINT "WebsiteDesignConcept_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteDesignSystem"
  ADD CONSTRAINT "WebsiteDesignSystem_designConceptId_fkey" FOREIGN KEY ("designConceptId") REFERENCES "public"."WebsiteDesignConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WebsiteDesignSystem_designConceptId_isCurrent_idx" ON "public"."WebsiteDesignSystem"("designConceptId", "isCurrent");
