/*
  Warnings:

  - You are about to drop the `CMSComponent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContentItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContentTypeVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GlobalComponent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GlobalComponentUsage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SiteStructure` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."CMSComponent" DROP CONSTRAINT "CMSComponent_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ComponentAnalytics" DROP CONSTRAINT "ComponentAnalytics_componentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ContentItem" DROP CONSTRAINT "ContentItem_contentTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ContentItem" DROP CONSTRAINT "ContentItem_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ContentTypeVersion" DROP CONSTRAINT "ContentTypeVersion_contentTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalComponent" DROP CONSTRAINT "GlobalComponent_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."GlobalComponentUsage" DROP CONSTRAINT "GlobalComponentUsage_globalComponentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SiteStructure" DROP CONSTRAINT "SiteStructure_contentItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SiteStructure" DROP CONSTRAINT "SiteStructure_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SiteStructure" DROP CONSTRAINT "SiteStructure_websiteId_fkey";

-- DropTable
DROP TABLE "public"."CMSComponent";

-- DropTable
DROP TABLE "public"."ContentItem";

-- DropTable
DROP TABLE "public"."ContentTypeVersion";

-- DropTable
DROP TABLE "public"."GlobalComponent";

-- DropTable
DROP TABLE "public"."GlobalComponentUsage";

-- DropTable
DROP TABLE "public"."SiteStructure";

-- CreateTable
CREATE TABLE "public"."WebsitePage" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB,
    "metadata" JSONB,
    "contentTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteCustomContentData" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "WebsiteCustomContentData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteStructure" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "fullPath" TEXT NOT NULL,
    "websitePageId" TEXT,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "pathDepth" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteComponentType" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "defaultConfig" JSONB NOT NULL,
    "placeholderData" JSONB NOT NULL,
    "styles" JSONB,
    "aiMetadata" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "websiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "WebsiteComponentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebsiteSharedComponent" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "websiteComponentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "WebsiteSharedComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "templatesGenerated" JSONB NOT NULL DEFAULT '[]',
    "detectionResults" JSONB NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteStructure_fullPath_idx" ON "public"."WebsiteStructure"("fullPath");

-- CreateIndex
CREATE INDEX "WebsiteStructure_parentId_idx" ON "public"."WebsiteStructure"("parentId");

-- CreateIndex
CREATE INDEX "WebsiteStructure_websiteId_idx" ON "public"."WebsiteStructure"("websiteId");

-- CreateIndex
CREATE INDEX "WebsiteStructure_pathDepth_idx" ON "public"."WebsiteStructure"("pathDepth");

-- CreateIndex
CREATE INDEX "WebsiteStructure_websitePageId_idx" ON "public"."WebsiteStructure"("websitePageId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteStructure_parentId_slug_key" ON "public"."WebsiteStructure"("parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteStructure_websiteId_fullPath_key" ON "public"."WebsiteStructure"("websiteId", "fullPath");

-- CreateIndex
CREATE INDEX "WebsiteComponentType_websiteId_type_idx" ON "public"."WebsiteComponentType"("websiteId", "type");

-- CreateIndex
CREATE INDEX "WebsiteComponentType_category_idx" ON "public"."WebsiteComponentType"("category");

-- CreateIndex
CREATE INDEX "WebsiteComponentType_createdAt_idx" ON "public"."WebsiteComponentType"("createdAt");

-- CreateIndex
CREATE INDEX "WebsiteComponentType_confidence_idx" ON "public"."WebsiteComponentType"("confidence");

-- CreateIndex
CREATE INDEX "WebsiteSharedComponent_websiteId_idx" ON "public"."WebsiteSharedComponent"("websiteId");

-- CreateIndex
CREATE INDEX "WebsiteSharedComponent_websiteComponentTypeId_idx" ON "public"."WebsiteSharedComponent"("websiteComponentTypeId");

-- CreateIndex
CREATE INDEX "ImportJob_websiteId_idx" ON "public"."ImportJob"("websiteId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "public"."ImportJob"("status");

-- AddForeignKey
ALTER TABLE "public"."WebsitePage" ADD CONSTRAINT "WebsitePage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsitePage" ADD CONSTRAINT "WebsitePage_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "public"."ContentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteCustomContentData" ADD CONSTRAINT "WebsiteCustomContentData_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteCustomContentData" ADD CONSTRAINT "WebsiteCustomContentData_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "public"."ContentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteStructure" ADD CONSTRAINT "WebsiteStructure_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteStructure" ADD CONSTRAINT "WebsiteStructure_websitePageId_fkey" FOREIGN KEY ("websitePageId") REFERENCES "public"."WebsitePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteStructure" ADD CONSTRAINT "WebsiteStructure_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."WebsiteStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteComponentType" ADD CONSTRAINT "WebsiteComponentType_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComponentAnalytics" ADD CONSTRAINT "ComponentAnalytics_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."WebsiteComponentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteSharedComponent" ADD CONSTRAINT "WebsiteSharedComponent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteSharedComponent" ADD CONSTRAINT "WebsiteSharedComponent_websiteComponentTypeId_fkey" FOREIGN KEY ("websiteComponentTypeId") REFERENCES "public"."WebsiteComponentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportJob" ADD CONSTRAINT "ImportJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
