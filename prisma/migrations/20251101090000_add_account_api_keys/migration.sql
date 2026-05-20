-- CreateEnum
CREATE TYPE "AccountApiKeyScope" AS ENUM ('ACCOUNT_READ', 'WEBSITE_READ');

-- CreateEnum
CREATE TYPE "AccountApiKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "AccountApiKeyEventType" AS ENUM ('issued', 'rotated', 'revoked', 'usage');

-- CreateTable
CREATE TABLE "public"."AccountApiKey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "websiteId" TEXT,
    "label" TEXT NOT NULL,
    "hashedSecret" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "scopes" "AccountApiKeyScope"[] NOT NULL DEFAULT ARRAY['ACCOUNT_READ']::"AccountApiKeyScope"[],
    "issuedBy" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "status" "AccountApiKeyStatus" NOT NULL DEFAULT 'active',
    "primaryKeyHash" TEXT NOT NULL,
    "secondaryKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountApiKeyEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "apiKeyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "websiteId" TEXT,
    "action" "AccountApiKeyEventType" NOT NULL,
    "actorId" UUID,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountApiKeyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountApiKey_accountId_status_idx" ON "public"."AccountApiKey"("accountId", "status");

-- CreateIndex
CREATE INDEX "AccountApiKey_accountId_websiteId_idx" ON "public"."AccountApiKey"("accountId", "websiteId");

-- CreateIndex
CREATE INDEX "AccountApiKey_websiteId_idx" ON "public"."AccountApiKey"("websiteId");

-- CreateIndex
CREATE INDEX "AccountApiKeyEvent_apiKeyId_occurredAt_idx" ON "public"."AccountApiKeyEvent"("apiKeyId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccountApiKeyEvent_accountId_occurredAt_idx" ON "public"."AccountApiKeyEvent"("accountId", "occurredAt");

-- AddForeignKey
ALTER TABLE "public"."AccountApiKey"
  ADD CONSTRAINT "AccountApiKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountApiKey"
  ADD CONSTRAINT "AccountApiKey_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountApiKeyEvent"
  ADD CONSTRAINT "AccountApiKeyEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "public"."AccountApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountApiKeyEvent"
  ADD CONSTRAINT "AccountApiKeyEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountApiKeyEvent"
  ADD CONSTRAINT "AccountApiKeyEvent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
