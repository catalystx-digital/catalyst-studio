ALTER TABLE "ImportPageStage"
  ADD COLUMN "attemptToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE INDEX "ImportPageStage_attemptToken_idx" ON "ImportPageStage"("attemptToken");
