/*
  Warnings:

  - You are about to drop the column `createdBy` on the `WebsitePage` table. All the data in the column will be lost.
  - You are about to drop the column `updatedBy` on the `WebsitePage` table. All the data in the column will be lost.
  - You are about to drop the `ConflictLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncState` table. If the table is not empty, all the data it contains will be lost.

*/
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- AlterTable
ALTER TABLE "public"."Website" ADD COLUMN     "accountId" UUID;

-- AlterTable
ALTER TABLE "public"."WebsitePage" DROP COLUMN "createdBy",
DROP COLUMN "updatedBy";

-- DropTable
DROP TABLE "public"."ConflictLog";

-- DropTable
DROP TABLE "public"."SyncHistory";

-- DropTable
DROP TABLE "public"."SyncState";

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "limits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountMembership" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UsageEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountQuota" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountMembership_userId_idx" ON "public"."AccountMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMembership_accountId_userId_key" ON "public"."AccountMembership"("accountId", "userId");

-- CreateIndex
CREATE INDEX "UsageEvent_accountId_kind_occurredAt_idx" ON "public"."UsageEvent"("accountId", "kind", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountQuota_accountId_kind_key" ON "public"."AccountQuota"("accountId", "kind");

-- CreateIndex
CREATE INDEX "Website_accountId_idx" ON "public"."Website"("accountId");

-- AddForeignKey
ALTER TABLE "public"."AccountMembership" ADD CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountMembership" ADD CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsageEvent" ADD CONSTRAINT "UsageEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountQuota" ADD CONSTRAINT "AccountQuota_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Website" ADD CONSTRAINT "Website_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
