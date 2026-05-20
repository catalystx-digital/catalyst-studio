-- Add optional accountId and relax websiteId requirement for AIContext
ALTER TABLE "AIContext"
  ADD COLUMN "accountId" UUID,
  ALTER COLUMN "websiteId" DROP NOT NULL;

-- Backfill accountId using owning website where available
UPDATE "AIContext" AS c
SET "accountId" = w."accountId"
FROM "Website" AS w
WHERE c."websiteId" = w."id" AND w."accountId" IS NOT NULL AND c."accountId" IS NULL;

-- Add foreign key for account reference
ALTER TABLE "AIContext"
  ADD CONSTRAINT "AIContext_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for account scoped queries
CREATE UNIQUE INDEX IF NOT EXISTS "AIContext_accountId_sessionId_key" ON "AIContext"("accountId", "sessionId");
CREATE INDEX IF NOT EXISTS "AIContext_accountId_idx" ON "AIContext"("accountId");
