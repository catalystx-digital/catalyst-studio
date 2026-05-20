-- Add missing columns to AccountMembership
ALTER TABLE "public"."AccountMembership" ADD COLUMN IF NOT EXISTS "websiteAccess" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "public"."AccountMembership" ADD COLUMN IF NOT EXISTS "websiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."AccountMembership" ADD COLUMN IF NOT EXISTS "invitedBy" UUID;
ALTER TABLE "public"."AccountMembership" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to UsageEvent
ALTER TABLE "public"."UsageEvent" ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER;
ALTER TABLE "public"."UsageEvent" ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;
ALTER TABLE "public"."UsageEvent" ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER;
ALTER TABLE "public"."UsageEvent" ADD COLUMN IF NOT EXISTS "model" TEXT;

-- Add missing columns to Website
ALTER TABLE "public"."Website" ADD COLUMN IF NOT EXISTS "agencyBranding" JSONB;
ALTER TABLE "public"."Website" ADD COLUMN IF NOT EXISTS "proposalTemplate" JSONB;

-- Add missing columns to WebsiteStructure
ALTER TABLE "public"."WebsiteStructure" ADD COLUMN IF NOT EXISTS "iaMetadata" JSONB;
ALTER TABLE "public"."WebsiteStructure" ADD COLUMN IF NOT EXISTS "iaStatus" TEXT;

-- Add missing columns to redirects table
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "is_external" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "nav_label" TEXT;
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "open_in_new_tab" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "show_in_nav" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."redirects" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Create missing enums
DO $$ BEGIN
    CREATE TYPE "public"."PreviewJobStatus" AS ENUM ('PENDING', 'CREATING_SANDBOX', 'SYNCING_FILES', 'READY', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."EmailDeliveryStatus" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."AuditAction" AS ENUM ('invitation_created', 'invitation_accepted', 'invitation_declined', 'invitation_revoked', 'invitation_resent', 'member_invited', 'member_role_changed', 'member_access_changed', 'member_removed', 'impersonation_started', 'impersonation_ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create PreviewJob table
CREATE TABLE IF NOT EXISTS "public"."PreviewJob" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "status" "public"."PreviewJobStatus" NOT NULL DEFAULT 'PENDING',
    "sandboxId" TEXT,
    "previewUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviewJob_pkey" PRIMARY KEY ("id")
);

-- Create ImportPageDetection table
CREATE TABLE IF NOT EXISTS "public"."ImportPageDetection" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "componentCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "detectionData" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportPageDetection_pkey" PRIMARY KEY ("id")
);

-- Create ContentReference table
CREATE TABLE IF NOT EXISTS "public"."ContentReference" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastValidatedAt" TIMESTAMP(3),

    CONSTRAINT "ContentReference_pkey" PRIMARY KEY ("id")
);

-- Create FailedReference table
CREATE TABLE IF NOT EXISTS "public"."FailedReference" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedReference_pkey" PRIMARY KEY ("id")
);

-- Create Invitation table
CREATE TABLE IF NOT EXISTS "public"."Invitation" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "websiteAccess" TEXT NOT NULL DEFAULT 'all',
    "websiteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedBy" UUID NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'pending',
    "emailStatus" "public"."EmailDeliveryStatus" NOT NULL DEFAULT 'pending',
    "emailError" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- Create SystemAdmin table
CREATE TABLE IF NOT EXISTS "public"."SystemAdmin" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedBy" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemAdmin_pkey" PRIMARY KEY ("id")
);

-- Create ImpersonationSession table
CREATE TABLE IF NOT EXISTS "public"."ImpersonationSession" (
    "id" TEXT NOT NULL,
    "systemAdminId" TEXT NOT NULL,
    "targetUserId" UUID NOT NULL,
    "targetAccountId" UUID NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- Create AuditLog table
CREATE TABLE IF NOT EXISTS "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "accountId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "action" "public"."AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PreviewJob_websiteId_idx" ON "public"."PreviewJob"("websiteId");
CREATE INDEX IF NOT EXISTS "PreviewJob_status_idx" ON "public"."PreviewJob"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "ImportPageDetection_jobId_pageUrl_key" ON "public"."ImportPageDetection"("jobId", "pageUrl");
CREATE INDEX IF NOT EXISTS "ImportPageDetection_jobId_idx" ON "public"."ImportPageDetection"("jobId");
CREATE INDEX IF NOT EXISTS "ImportPageDetection_jobId_status_idx" ON "public"."ImportPageDetection"("jobId", "status");
CREATE INDEX IF NOT EXISTS "ImportPageDetection_websiteId_idx" ON "public"."ImportPageDetection"("websiteId");

CREATE INDEX IF NOT EXISTS "ContentReference_sourceId_idx" ON "public"."ContentReference"("sourceId");
CREATE INDEX IF NOT EXISTS "ContentReference_targetId_idx" ON "public"."ContentReference"("targetId");
CREATE INDEX IF NOT EXISTS "ContentReference_websiteId_targetType_idx" ON "public"."ContentReference"("websiteId", "targetType");
CREATE INDEX IF NOT EXISTS "ContentReference_websiteId_status_idx" ON "public"."ContentReference"("websiteId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ContentReference_sourceId_sourcePath_targetId_key" ON "public"."ContentReference"("sourceId", "sourcePath", "targetId");

CREATE UNIQUE INDEX IF NOT EXISTS "FailedReference_sourceId_sourcePath_originalUrl_key" ON "public"."FailedReference"("sourceId", "sourcePath", "originalUrl");
CREATE INDEX IF NOT EXISTS "FailedReference_websiteId_idx" ON "public"."FailedReference"("websiteId");

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "public"."Invitation"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_accountId_email_key" ON "public"."Invitation"("accountId", "email");
CREATE INDEX IF NOT EXISTS "Invitation_accountId_status_idx" ON "public"."Invitation"("accountId", "status");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "public"."Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "public"."Invitation"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "SystemAdmin_userId_key" ON "public"."SystemAdmin"("userId");

CREATE INDEX IF NOT EXISTS "ImpersonationSession_targetUserId_targetAccountId_idx" ON "public"."ImpersonationSession"("targetUserId", "targetAccountId");
CREATE INDEX IF NOT EXISTS "ImpersonationSession_systemAdminId_idx" ON "public"."ImpersonationSession"("systemAdminId");

CREATE INDEX IF NOT EXISTS "AuditLog_accountId_occurredAt_idx" ON "public"."AuditLog"("accountId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "public"."AuditLog"("actorId");

-- Create index on redirects if missing
CREATE INDEX IF NOT EXISTS "redirects_website_id_is_external_idx" ON "public"."redirects"("website_id", "is_external");

-- Add foreign keys
ALTER TABLE "public"."PreviewJob" DROP CONSTRAINT IF EXISTS "PreviewJob_websiteId_fkey";
ALTER TABLE "public"."PreviewJob" ADD CONSTRAINT "PreviewJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ImportPageDetection" DROP CONSTRAINT IF EXISTS "ImportPageDetection_jobId_fkey";
ALTER TABLE "public"."ImportPageDetection" ADD CONSTRAINT "ImportPageDetection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ContentReference" DROP CONSTRAINT IF EXISTS "ContentReference_websiteId_fkey";
ALTER TABLE "public"."ContentReference" ADD CONSTRAINT "ContentReference_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FailedReference" DROP CONSTRAINT IF EXISTS "FailedReference_websiteId_fkey";
ALTER TABLE "public"."FailedReference" ADD CONSTRAINT "FailedReference_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Invitation" DROP CONSTRAINT IF EXISTS "Invitation_accountId_fkey";
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."SystemAdmin" DROP CONSTRAINT IF EXISTS "SystemAdmin_userId_fkey";
ALTER TABLE "public"."SystemAdmin" ADD CONSTRAINT "SystemAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ImpersonationSession" DROP CONSTRAINT IF EXISTS "ImpersonationSession_systemAdminId_fkey";
ALTER TABLE "public"."ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_systemAdminId_fkey" FOREIGN KEY ("systemAdminId") REFERENCES "public"."SystemAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
