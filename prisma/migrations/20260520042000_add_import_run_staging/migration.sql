-- Add authoritative import run and per-page staging records.

CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "normalizedSourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "phase" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "stagedPages" INTEGER NOT NULL DEFAULT 0,
    "committedPages" INTEGER NOT NULL DEFAULT 0,
    "failedPages" INTEGER NOT NULL DEFAULT 0,
    "recoverableActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importPlan" JSONB,
    "lastError" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportPageStage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "normalizedPageUrl" TEXT NOT NULL,
    "normalizedPath" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "phase" TEXT NOT NULL DEFAULT 'queued',
    "detectionPayload" JSONB,
    "pageContent" JSONB,
    "structureCandidate" JSONB,
    "contentFingerprint" TEXT,
    "committedPageId" TEXT,
    "error" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportPageStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "code" TEXT,
    "category" TEXT,
    "phase" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'run',
    "pageUrl" TEXT,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRunEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportRun_importJobId_key" ON "ImportRun"("importJobId");
CREATE INDEX "ImportRun_websiteId_idx" ON "ImportRun"("websiteId");
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");
CREATE INDEX "ImportRun_phase_idx" ON "ImportRun"("phase");
CREATE INDEX "ImportRun_updatedAt_idx" ON "ImportRun"("updatedAt");

CREATE UNIQUE INDEX "ImportPageStage_runId_normalizedPageUrl_key" ON "ImportPageStage"("runId", "normalizedPageUrl");
CREATE INDEX "ImportPageStage_runId_idx" ON "ImportPageStage"("runId");
CREATE INDEX "ImportPageStage_websiteId_idx" ON "ImportPageStage"("websiteId");
CREATE INDEX "ImportPageStage_status_idx" ON "ImportPageStage"("status");
CREATE INDEX "ImportPageStage_committedPageId_idx" ON "ImportPageStage"("committedPageId");

CREATE INDEX "ImportRunEvent_runId_idx" ON "ImportRunEvent"("runId");
CREATE INDEX "ImportRunEvent_websiteId_idx" ON "ImportRunEvent"("websiteId");
CREATE INDEX "ImportRunEvent_level_idx" ON "ImportRunEvent"("level");
CREATE INDEX "ImportRunEvent_createdAt_idx" ON "ImportRunEvent"("createdAt");

ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportPageStage" ADD CONSTRAINT "ImportPageStage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRunEvent" ADD CONSTRAINT "ImportRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
