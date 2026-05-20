-- CreateTable
CREATE TABLE "GlobalComponent" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalComponentUsage" (
    "id" TEXT NOT NULL,
    "globalComponentId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "overrides" JSONB,

    CONSTRAINT "GlobalComponentUsage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CMSComponent" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "GlobalComponent_websiteId_idx" ON "GlobalComponent"("websiteId");

-- CreateIndex
CREATE INDEX "GlobalComponentUsage_globalComponentId_idx" ON "GlobalComponentUsage"("globalComponentId");

-- CreateIndex
CREATE INDEX "GlobalComponentUsage_pageId_idx" ON "GlobalComponentUsage"("pageId");

-- AddForeignKey
ALTER TABLE "GlobalComponent" ADD CONSTRAINT "GlobalComponent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalComponentUsage" ADD CONSTRAINT "GlobalComponentUsage_globalComponentId_fkey" FOREIGN KEY ("globalComponentId") REFERENCES "GlobalComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;