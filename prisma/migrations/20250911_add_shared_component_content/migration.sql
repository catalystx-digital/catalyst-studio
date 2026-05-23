-- Epic 41 Phase 0: Add canonical content column for shared components
-- Adds content JSONB for canonical shared component content.

-- Add column if not exists (idempotent safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'WebsiteSharedComponent' AND column_name = 'content'
  ) THEN
    ALTER TABLE "WebsiteSharedComponent" ADD COLUMN "content" JSONB;
  END IF;
END $$;

UPDATE "WebsiteSharedComponent"
SET "content" = '{}'::jsonb
WHERE "content" IS NULL;

