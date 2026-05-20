-- Begin transaction with savepoint for safe rollback
BEGIN;
SAVEPOINT cms_component_migration;

-- Create CMSComponent table if not exists
CREATE TABLE IF NOT EXISTS "CMSComponent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "props" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "styles" JSONB,
    "aiMetadata" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "websiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "CMSComponent_pkey" PRIMARY KEY ("id")
);

-- Create ComponentAnalytics table if not exists
CREATE TABLE IF NOT EXISTS "ComponentAnalytics" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "renderCount" INTEGER NOT NULL DEFAULT 0,
    "avgRenderTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "mobileViews" INTEGER NOT NULL DEFAULT 0,
    "tabletViews" INTEGER NOT NULL DEFAULT 0,
    "desktopViews" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentAnalytics_pkey" PRIMARY KEY ("id")
);

-- Create indexes if not exists (using DO block for idempotency)
DO $$ 
BEGIN
    -- CMSComponent indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CMSComponent_websiteId_type_idx') THEN
        CREATE INDEX "CMSComponent_websiteId_type_idx" ON "CMSComponent"("websiteId", "type");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CMSComponent_category_idx') THEN
        CREATE INDEX "CMSComponent_category_idx" ON "CMSComponent"("category");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CMSComponent_createdAt_idx') THEN
        CREATE INDEX "CMSComponent_createdAt_idx" ON "CMSComponent"("createdAt");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'CMSComponent_confidence_idx') THEN
        CREATE INDEX "CMSComponent_confidence_idx" ON "CMSComponent"("confidence");
    END IF;
    
    -- ComponentAnalytics indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ComponentAnalytics_componentId_idx') THEN
        CREATE INDEX "ComponentAnalytics_componentId_idx" ON "ComponentAnalytics"("componentId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ComponentAnalytics_componentType_idx') THEN
        CREATE INDEX "ComponentAnalytics_componentType_idx" ON "ComponentAnalytics"("componentType");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ComponentAnalytics_date_idx') THEN
        CREATE INDEX "ComponentAnalytics_date_idx" ON "ComponentAnalytics"("date");
    END IF;
END $$;

-- Add foreign key constraints if not exists
DO $$
BEGIN
    -- Foreign key for CMSComponent.websiteId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CMSComponent_websiteId_fkey'
    ) THEN
        ALTER TABLE "CMSComponent" 
        ADD CONSTRAINT "CMSComponent_websiteId_fkey" 
        FOREIGN KEY ("websiteId") 
        REFERENCES "Website"("id") 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE;
    END IF;
    
    -- Foreign key for ComponentAnalytics.componentId
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ComponentAnalytics_componentId_fkey'
    ) THEN
        ALTER TABLE "ComponentAnalytics" 
        ADD CONSTRAINT "ComponentAnalytics_componentId_fkey" 
        FOREIGN KEY ("componentId") 
        REFERENCES "CMSComponent"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Data preservation: Store existing component data from ContentItem table
-- This creates a temporary table to preserve component-type ContentItems
CREATE TEMP TABLE IF NOT EXISTS existing_components_backup AS
SELECT 
    ci.*,
    ct.category as content_category
FROM "ContentItem" ci
JOIN "ContentType" ct ON ci."contentTypeId" = ct."id"
WHERE ct."category" = 'component';

-- Mark migration as complete
COMMIT;