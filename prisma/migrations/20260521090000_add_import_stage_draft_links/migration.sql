ALTER TABLE "ImportPageStage"
  ADD COLUMN "draftPageId" TEXT,
  ADD COLUMN "draftStructureId" TEXT;

CREATE INDEX "ImportPageStage_draftPageId_idx" ON "ImportPageStage"("draftPageId");
CREATE INDEX "ImportPageStage_draftStructureId_idx" ON "ImportPageStage"("draftStructureId");
