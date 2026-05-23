UPDATE "WebsiteSharedComponent"
SET "content" = '{}'::jsonb
WHERE "content" IS NULL OR "content" = 'null'::jsonb;

ALTER TABLE "WebsiteSharedComponent"
ALTER COLUMN "content" SET NOT NULL;
