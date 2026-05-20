-- Add template metadata columns to WebsitePage for page template registry
ALTER TABLE "public"."WebsitePage" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "public"."WebsitePage" ADD COLUMN "templateProps" JSONB;

