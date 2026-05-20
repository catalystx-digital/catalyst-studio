-- CreateEnum
CREATE TYPE "public"."IntegrationStatus" AS ENUM ('enabled', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "public"."IntegrationProvider" AS ENUM ('optimizely', 'contentful', 'strapi', 'mock');

-- CreateEnum
CREATE TYPE "public"."IntegrationUsageAction" AS ENUM ('deploy', 'test', 'export');

-- CreateEnum
CREATE TYPE "public"."QuotaPeriod" AS ENUM ('day', 'week', 'month');

-- CreateTable
CREATE TABLE "public"."AccountIntegration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "provider" "public"."IntegrationProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "public"."IntegrationStatus" NOT NULL DEFAULT 'enabled',
    "config" JSONB,
    "secretCiphertext" BYTEA,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "AccountIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationUsage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountIntegrationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "websiteId" TEXT,
    "deploymentId" TEXT,
    "action" "public"."IntegrationUsageAction" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationUsage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."AccountQuota" ADD COLUMN     "period" "public"."QuotaPeriod";

-- AlterTable
ALTER TABLE "public"."Deployment" ADD COLUMN     "accountId" UUID;
ALTER TABLE "public"."Deployment" ADD COLUMN     "accountIntegrationId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "AccountIntegration_accountId_provider_displayName_key" ON "public"."AccountIntegration"("accountId", "provider", "displayName");

-- CreateIndex
CREATE INDEX "AccountIntegration_accountId_provider_idx" ON "public"."AccountIntegration"("accountId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationUsage_accountId_occurredAt_idx" ON "public"."IntegrationUsage"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntegrationUsage_accountIntegrationId_occurredAt_idx" ON "public"."IntegrationUsage"("accountIntegrationId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntegrationUsage_deploymentId_idx" ON "public"."IntegrationUsage"("deploymentId");

-- CreateIndex
CREATE INDEX "IntegrationUsage_websiteId_idx" ON "public"."IntegrationUsage"("websiteId");

-- CreateIndex
CREATE INDEX "Deployment_accountId_idx" ON "public"."Deployment"("accountId");

-- CreateIndex
CREATE INDEX "Deployment_accountIntegrationId_idx" ON "public"."Deployment"("accountIntegrationId");

-- AddForeignKey
ALTER TABLE "public"."AccountIntegration" ADD CONSTRAINT "AccountIntegration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationUsage" ADD CONSTRAINT "IntegrationUsage_accountIntegrationId_fkey" FOREIGN KEY ("accountIntegrationId") REFERENCES "public"."AccountIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationUsage" ADD CONSTRAINT "IntegrationUsage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationUsage" ADD CONSTRAINT "IntegrationUsage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrationUsage" ADD CONSTRAINT "IntegrationUsage_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "public"."Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deployment" ADD CONSTRAINT "Deployment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Deployment" ADD CONSTRAINT "Deployment_accountIntegrationId_fkey" FOREIGN KEY ("accountIntegrationId") REFERENCES "public"."AccountIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
