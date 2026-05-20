ALTER TABLE "ImportRun"
ADD COLUMN IF NOT EXISTS "cancellationRequestedAt" TIMESTAMP(3);
