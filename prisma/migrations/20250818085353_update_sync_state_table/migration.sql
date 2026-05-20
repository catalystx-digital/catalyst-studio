-- AlterTable
ALTER TABLE "public"."SyncState" ADD COLUMN     "lastSyncedHash" TEXT,
ADD COLUMN     "syncProgress" JSONB,
ALTER COLUMN "syncStatus" DROP NOT NULL;

-- Update existing rows to ensure syncStatus is not null
UPDATE "public"."SyncState" 
SET "syncStatus" = 'pending' 
WHERE "syncStatus" IS NULL;

-- CreateIndex
CREATE INDEX "SyncState_lastSyncAt_idx" ON "public"."SyncState"("lastSyncAt");

-- CreateTable for SiteStructure (Epic 8)
CREATE TABLE "public"."SiteStructure" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "parentId" TEXT,
    "slug" VARCHAR(255) NOT NULL,
    "fullPath" TEXT NOT NULL,
    "pathDepth" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for SiteStructure
CREATE INDEX "SiteStructure_fullPath_idx" ON "public"."SiteStructure"("fullPath");
CREATE INDEX "SiteStructure_parentId_idx" ON "public"."SiteStructure"("parentId");
CREATE INDEX "SiteStructure_websiteId_idx" ON "public"."SiteStructure"("websiteId");
CREATE INDEX "SiteStructure_pathDepth_idx" ON "public"."SiteStructure"("pathDepth");
CREATE INDEX "SiteStructure_contentItemId_idx" ON "public"."SiteStructure"("contentItemId");
CREATE INDEX "SiteStructure_websiteId_fullPath_idx" ON "public"."SiteStructure"("websiteId", "fullPath");
CREATE UNIQUE INDEX "SiteStructure_parentId_slug_key" ON "public"."SiteStructure"("parentId", "slug");

-- AddForeignKey for SiteStructure
ALTER TABLE "public"."SiteStructure" ADD CONSTRAINT "SiteStructure_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SiteStructure" ADD CONSTRAINT "SiteStructure_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "public"."ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."SiteStructure" ADD CONSTRAINT "SiteStructure_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."SiteStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
