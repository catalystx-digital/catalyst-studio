ALTER TABLE "ImportRun"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "ImportRun_websiteId_idempotencyKey_key"
  ON "ImportRun"("websiteId", "idempotencyKey");

CREATE UNIQUE INDEX "ImportPageStage_runId_normalizedPath_key"
  ON "ImportPageStage"("runId", "normalizedPath");

CREATE UNIQUE INDEX "ImportRun_one_active_per_website_idx"
  ON "ImportRun"("websiteId")
  WHERE "status" IN (
    'queued',
    'discovering',
    'importing',
    'running',
    'detecting',
    'normalizing',
    'staged',
    'committing'
  );
