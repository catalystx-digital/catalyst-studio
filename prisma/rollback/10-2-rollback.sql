-- Rollback procedure for Story 10.2: Database Schema & Migration
-- This script safely removes the CMSComponent and ComponentAnalytics tables
-- while preserving any data that may have been migrated

BEGIN TRANSACTION;
SAVEPOINT cms_component_rollback;

-- Step 1: Backup any existing data before rollback (if tables exist)
DO $$
BEGIN
    -- Check if CMSComponent table exists before backing up
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CMSComponent'
    ) THEN
        -- Create backup table for CMSComponent data
        CREATE TABLE IF NOT EXISTS "CMSComponent_rollback_backup" AS 
        SELECT * FROM "CMSComponent";
        
        RAISE NOTICE 'CMSComponent data backed up to CMSComponent_rollback_backup';
    END IF;
    
    -- Check if ComponentAnalytics table exists before backing up
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ComponentAnalytics'
    ) THEN
        -- Create backup table for ComponentAnalytics data
        CREATE TABLE IF NOT EXISTS "ComponentAnalytics_rollback_backup" AS 
        SELECT * FROM "ComponentAnalytics";
        
        RAISE NOTICE 'ComponentAnalytics data backed up to ComponentAnalytics_rollback_backup';
    END IF;
END $$;

-- Step 2: Drop foreign key constraints if they exist
DO $$
BEGIN
    -- Drop CMSComponent foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CMSComponent_websiteId_fkey'
    ) THEN
        ALTER TABLE "CMSComponent" DROP CONSTRAINT "CMSComponent_websiteId_fkey";
        RAISE NOTICE 'Dropped foreign key constraint CMSComponent_websiteId_fkey';
    END IF;
    
    -- Drop ComponentAnalytics foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ComponentAnalytics_componentId_fkey'
    ) THEN
        ALTER TABLE "ComponentAnalytics" DROP CONSTRAINT "ComponentAnalytics_componentId_fkey";
        RAISE NOTICE 'Dropped foreign key constraint ComponentAnalytics_componentId_fkey';
    END IF;
END $$;

-- Step 3: Drop indexes if they exist
DROP INDEX IF EXISTS "CMSComponent_websiteId_type_idx";
DROP INDEX IF EXISTS "CMSComponent_category_idx";
DROP INDEX IF EXISTS "CMSComponent_createdAt_idx";
DROP INDEX IF EXISTS "CMSComponent_confidence_idx";
DROP INDEX IF EXISTS "ComponentAnalytics_componentId_idx";
DROP INDEX IF EXISTS "ComponentAnalytics_componentType_idx";
DROP INDEX IF EXISTS "ComponentAnalytics_date_idx";

-- Step 4: Drop tables if they exist
DROP TABLE IF EXISTS "ComponentAnalytics" CASCADE;
DROP TABLE IF EXISTS "CMSComponent" CASCADE;

-- Step 5: Verify rollback was successful
DO $$
BEGIN
    -- Check that CMSComponent table no longer exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CMSComponent'
    ) THEN
        RAISE EXCEPTION 'CMSComponent table still exists after rollback';
    END IF;
    
    -- Check that ComponentAnalytics table no longer exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ComponentAnalytics'
    ) THEN
        RAISE EXCEPTION 'ComponentAnalytics table still exists after rollback';
    END IF;
    
    RAISE NOTICE 'Rollback completed successfully';
END $$;

-- Commit the rollback transaction
COMMIT;

-- Instructions for restoring data:
-- If you need to restore the backed-up data after re-running the migration:
-- 1. Re-run the forward migration
-- 2. Execute: INSERT INTO "CMSComponent" SELECT * FROM "CMSComponent_rollback_backup";
-- 3. Execute: INSERT INTO "ComponentAnalytics" SELECT * FROM "ComponentAnalytics_rollback_backup";
-- 4. Clean up: DROP TABLE IF EXISTS "CMSComponent_rollback_backup";
-- 5. Clean up: DROP TABLE IF EXISTS "ComponentAnalytics_rollback_backup";