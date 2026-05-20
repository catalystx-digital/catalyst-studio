-- CreateEnum
CREATE TYPE "ContentTypeCategory" AS ENUM ('page', 'component');

-- CreateTable
CREATE TABLE "public"."Website" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "metadata" JSONB,
    "icon" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "displayField" TEXT,
    "category" "ContentTypeCategory" NOT NULL DEFAULT 'page',
    "fields" JSONB NOT NULL,
    "websiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AIContext" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT 'default',
    "context" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentItem" (
    "id" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deployment" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deploymentData" JSONB,
    "errorMessage" TEXT,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContentTypeVersion" (
    "id" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "parentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTypeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncHistory" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "targetSystem" TEXT NOT NULL,
    "syncData" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncState" (
    "id" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "localHash" TEXT,
    "remoteHash" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "conflictStatus" TEXT,
    "lastConflictAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConflictLog" (
    "id" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "localHash" TEXT NOT NULL,
    "remoteHash" TEXT NOT NULL,
    "ancestorHash" TEXT,
    "conflictType" TEXT NOT NULL,
    "conflictDetails" JSONB NOT NULL,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentType_websiteId_idx" ON "public"."ContentType"("websiteId");

-- CreateIndex
CREATE INDEX "ContentType_category_idx" ON "public"."ContentType"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ContentType_websiteId_key_key" ON "public"."ContentType"("websiteId", "key");

-- CreateIndex
CREATE INDEX "AIContext_websiteId_idx" ON "public"."AIContext"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "AIContext_websiteId_sessionId_key" ON "public"."AIContext"("websiteId", "sessionId");

-- CreateIndex
CREATE INDEX "ContentItem_websiteId_idx" ON "public"."ContentItem"("websiteId");

-- CreateIndex
CREATE INDEX "ContentItem_contentTypeId_idx" ON "public"."ContentItem"("contentTypeId");

-- CreateIndex
CREATE INDEX "ContentItem_status_idx" ON "public"."ContentItem"("status");

-- CreateIndex
CREATE INDEX "ContentItem_publishedAt_idx" ON "public"."ContentItem"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_websiteId_slug_key" ON "public"."ContentItem"("websiteId", "slug");

-- CreateIndex
CREATE INDEX "Deployment_websiteId_idx" ON "public"."Deployment"("websiteId");

-- CreateIndex
CREATE INDEX "Deployment_provider_idx" ON "public"."Deployment"("provider");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "public"."Deployment"("status");

-- CreateIndex
CREATE INDEX "ContentTypeVersion_contentTypeId_idx" ON "public"."ContentTypeVersion"("contentTypeId");

-- CreateIndex
CREATE INDEX "ContentTypeVersion_typeKey_idx" ON "public"."ContentTypeVersion"("typeKey");

-- CreateIndex
CREATE INDEX "ContentTypeVersion_parentHash_idx" ON "public"."ContentTypeVersion"("parentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTypeVersion_typeKey_version_key" ON "public"."ContentTypeVersion"("typeKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTypeVersion_hash_key" ON "public"."ContentTypeVersion"("hash");

-- CreateIndex
CREATE INDEX "SyncHistory_websiteId_idx" ON "public"."SyncHistory"("websiteId");

-- CreateIndex
CREATE INDEX "SyncHistory_syncType_idx" ON "public"."SyncHistory"("syncType");

-- CreateIndex
CREATE INDEX "SyncHistory_status_idx" ON "public"."SyncHistory"("status");

-- CreateIndex
CREATE INDEX "SyncHistory_startedAt_idx" ON "public"."SyncHistory"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_typeKey_key" ON "public"."SyncState"("typeKey");

-- CreateIndex
CREATE INDEX "SyncState_syncStatus_idx" ON "public"."SyncState"("syncStatus");

-- CreateIndex
CREATE INDEX "SyncState_conflictStatus_idx" ON "public"."SyncState"("conflictStatus");

-- CreateIndex
CREATE INDEX "ConflictLog_typeKey_createdAt_idx" ON "public"."ConflictLog"("typeKey", "createdAt");

-- CreateIndex
CREATE INDEX "ConflictLog_resolution_idx" ON "public"."ConflictLog"("resolution");

-- AddForeignKey
ALTER TABLE "public"."ContentType" ADD CONSTRAINT "ContentType_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AIContext" ADD CONSTRAINT "AIContext_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentItem" ADD CONSTRAINT "ContentItem_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "public"."ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentItem" ADD CONSTRAINT "ContentItem_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deployment" ADD CONSTRAINT "Deployment_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentTypeVersion" ADD CONSTRAINT "ContentTypeVersion_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "public"."ContentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."redirects" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "source_path" TEXT NOT NULL,
    "target_path" TEXT NOT NULL,
    "redirect_type" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redirects_website_id_source_path_key" ON "public"."redirects"("website_id", "source_path");

-- CreateIndex
CREATE INDEX "redirects_source_path_idx" ON "public"."redirects"("source_path");

-- CreateIndex
CREATE INDEX "redirects_website_id_is_active_idx" ON "public"."redirects"("website_id", "is_active");

-- AddForeignKey
ALTER TABLE "public"."redirects" ADD CONSTRAINT "redirects_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
