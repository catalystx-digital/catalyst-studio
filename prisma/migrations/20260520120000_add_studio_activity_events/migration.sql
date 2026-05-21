-- Add revision primitives for safe multi-client editing.
ALTER TABLE "Website" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WebsitePage" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- Per-website event sequence cursor. This row is updated transactionally by
-- StudioEventBus before inserting a StudioEvent; do not derive sequence via max()+1.
CREATE TABLE "WebsiteEventCursor" (
  "websiteId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebsiteEventCursor_pkey" PRIMARY KEY ("websiteId"),
  CONSTRAINT "WebsiteEventCursor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StudioEvent" (
  "id" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorSessionId" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "revision" INTEGER,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudioEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudioEvent_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudioEvent_websiteId_sequence_key" ON "StudioEvent"("websiteId", "sequence");
CREATE INDEX "StudioEvent_websiteId_createdAt_idx" ON "StudioEvent"("websiteId", "createdAt");
CREATE INDEX "StudioEvent_websiteId_type_idx" ON "StudioEvent"("websiteId", "type");
CREATE INDEX "StudioEvent_resourceType_resourceId_idx" ON "StudioEvent"("resourceType", "resourceId");
