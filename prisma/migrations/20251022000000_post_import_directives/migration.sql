-- Create enum for directive workflow
CREATE TYPE "PostImportDirectiveStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Ensure import jobs capture metadata emitted by the importer
ALTER TABLE "public"."ImportJob"
ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Track downstream actions that must run after import finishes
CREATE TABLE "public"."PostImportDirective" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "instructions" JSONB NOT NULL,
    "status" "PostImportDirectiveStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "executionResult" JSONB,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostImportDirective_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PostImportDirective_importJobId_idx" ON "public"."PostImportDirective"("importJobId");
CREATE INDEX "PostImportDirective_websiteId_idx" ON "public"."PostImportDirective"("websiteId");

ALTER TABLE "public"."PostImportDirective"
ADD CONSTRAINT "PostImportDirective_importJobId_fkey"
FOREIGN KEY ("importJobId") REFERENCES "public"."ImportJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."PostImportDirective"
ADD CONSTRAINT "PostImportDirective_websiteId_fkey"
FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
