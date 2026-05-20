-- Standardize table names to PascalCase (matching all other Catalyst Studio tables)
-- Previously: redirects -> Redirect, node_positions -> NodePosition
-- Also standardize Redirect column names from snake_case to camelCase

-- Step 1: Rename redirects table to Redirect
ALTER TABLE "public"."redirects" RENAME TO "Redirect";

-- Step 2: Rename node_positions table to NodePosition
ALTER TABLE "public"."node_positions" RENAME TO "NodePosition";

-- Step 3: Rename Redirect columns from snake_case to camelCase
ALTER TABLE "public"."Redirect" RENAME COLUMN "website_id" TO "websiteId";
ALTER TABLE "public"."Redirect" RENAME COLUMN "source_path" TO "sourcePath";
ALTER TABLE "public"."Redirect" RENAME COLUMN "target_path" TO "targetPath";
ALTER TABLE "public"."Redirect" RENAME COLUMN "redirect_type" TO "redirectType";
ALTER TABLE "public"."Redirect" RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "public"."Redirect" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "public"."Redirect" RENAME COLUMN "updated_at" TO "updatedAt";
ALTER TABLE "public"."Redirect" RENAME COLUMN "is_external" TO "isExternal";
ALTER TABLE "public"."Redirect" RENAME COLUMN "nav_label" TO "navLabel";
ALTER TABLE "public"."Redirect" RENAME COLUMN "open_in_new_tab" TO "openInNewTab";
ALTER TABLE "public"."Redirect" RENAME COLUMN "show_in_nav" TO "showInNav";

-- Step 4: Rename indexes to match new table/column names
-- Drop old indexes and create new ones with correct names

-- Redirect indexes
DROP INDEX IF EXISTS "public"."redirects_website_id_source_path_key";
DROP INDEX IF EXISTS "public"."redirects_source_path_idx";
DROP INDEX IF EXISTS "public"."redirects_website_id_is_active_idx";
DROP INDEX IF EXISTS "public"."redirects_website_id_is_external_idx";

CREATE UNIQUE INDEX "Redirect_websiteId_sourcePath_key" ON "public"."Redirect"("websiteId", "sourcePath");
CREATE INDEX "Redirect_sourcePath_idx" ON "public"."Redirect"("sourcePath");
CREATE INDEX "Redirect_websiteId_isActive_idx" ON "public"."Redirect"("websiteId", "isActive");
CREATE INDEX "Redirect_websiteId_isExternal_idx" ON "public"."Redirect"("websiteId", "isExternal");

-- Step 5: Rename foreign keys and constraints to match new naming convention
-- NodePosition foreign keys
ALTER TABLE "public"."NodePosition" DROP CONSTRAINT IF EXISTS "node_positions_structureId_fkey";
ALTER TABLE "public"."NodePosition" DROP CONSTRAINT IF EXISTS "node_positions_websiteId_fkey";
ALTER TABLE "public"."NodePosition" ADD CONSTRAINT "NodePosition_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "public"."WebsiteStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."NodePosition" ADD CONSTRAINT "NodePosition_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NodePosition unique constraint
ALTER INDEX IF EXISTS "node_positions_structureId_key" RENAME TO "NodePosition_structureId_key";

-- Redirect foreign key
ALTER TABLE "public"."Redirect" DROP CONSTRAINT IF EXISTS "redirects_website_id_fkey";
ALTER TABLE "public"."Redirect" ADD CONSTRAINT "Redirect_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Primary keys (rename constraints)
ALTER TABLE "public"."NodePosition" DROP CONSTRAINT IF EXISTS "node_positions_pkey";
ALTER TABLE "public"."NodePosition" ADD CONSTRAINT "NodePosition_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."Redirect" DROP CONSTRAINT IF EXISTS "redirects_pkey";
ALTER TABLE "public"."Redirect" ADD CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id");
