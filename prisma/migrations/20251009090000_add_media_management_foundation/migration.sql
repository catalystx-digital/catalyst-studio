CREATE TYPE "MediaStorageProvider" AS ENUM ('FILE', 'S3');

CREATE TYPE "MediaUsageType" AS ENUM (
  'page_component',
  'shared_component',
  'custom_content',
  'ai_generated'
);

CREATE TABLE "WebsiteMedia" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "contentId" TEXT,
  "provider" "MediaStorageProvider" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "duration" DOUBLE PRECISION,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteMedia_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebsiteMedia_websiteId_storageKey_key" ON "WebsiteMedia"("websiteId", "storageKey");
CREATE UNIQUE INDEX "WebsiteMedia_websiteId_checksum_key" ON "WebsiteMedia"("websiteId", "checksum");
CREATE INDEX "WebsiteMedia_websiteId_contentType_idx" ON "WebsiteMedia"("websiteId", "contentType");

CREATE TABLE "WebsiteMediaSource" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "contentId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteMediaSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteMediaSource_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WebsiteMediaSource_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "WebsiteMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebsiteMediaSource_websiteId_originalUrl_key" ON "WebsiteMediaSource"("websiteId", "originalUrl");
CREATE INDEX "WebsiteMediaSource_mediaId_idx" ON "WebsiteMediaSource"("mediaId");

CREATE TABLE "WebsiteMediaUsage" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "contentId" TEXT,
  "pageId" TEXT,
  "componentInstanceId" TEXT,
  "usageType" "MediaUsageType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteMediaUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteMediaUsage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WebsiteMediaUsage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "WebsiteMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebsiteMediaUsage_websiteId_usageType_idx" ON "WebsiteMediaUsage"("websiteId", "usageType");
CREATE INDEX "WebsiteMediaUsage_mediaId_idx" ON "WebsiteMediaUsage"("mediaId");
CREATE INDEX "WebsiteMediaUsage_pageId_idx" ON "WebsiteMediaUsage"("pageId");
CREATE INDEX "WebsiteMediaUsage_componentInstanceId_idx" ON "WebsiteMediaUsage"("componentInstanceId");
