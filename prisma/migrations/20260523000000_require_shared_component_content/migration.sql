UPDATE "WebsiteSharedComponent"
SET "content" = COALESCE(NULLIF("config"->'defaultProps', 'null'::jsonb), '{}'::jsonb)
WHERE "content" IS NULL OR "content" = 'null'::jsonb;

UPDATE "WebsiteSharedComponent"
SET "config" = "config" - 'defaultProps'
WHERE jsonb_typeof("config") = 'object' AND "config" ? 'defaultProps';

ALTER TABLE "WebsiteSharedComponent"
ALTER COLUMN "content" SET NOT NULL;
