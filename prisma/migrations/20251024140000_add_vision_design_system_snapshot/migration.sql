CREATE TABLE "public"."VisionDesignSystemSnapshot" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceJobId" TEXT,
    "captureStrategy" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "cssDesignSystemId" TEXT,
    "visionPayload" JSONB NOT NULL,
    "featureSummary" JSONB NOT NULL,
    "captureMeta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionDesignSystemSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisionDesignSystemSnapshot_cssDesignSystemId_idx"
    ON "public"."VisionDesignSystemSnapshot"("cssDesignSystemId");

CREATE INDEX "VisionDesignSystemSnapshot_sourceJobId_idx"
    ON "public"."VisionDesignSystemSnapshot"("sourceJobId");

CREATE INDEX "VisionDesignSystemSnapshot_websiteId_idx"
    ON "public"."VisionDesignSystemSnapshot"("websiteId");

ALTER TABLE "public"."VisionDesignSystemSnapshot"
ADD CONSTRAINT "VisionDesignSystemSnapshot_cssDesignSystemId_fkey"
FOREIGN KEY ("cssDesignSystemId") REFERENCES "public"."WebsiteDesignSystem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."VisionDesignSystemSnapshot"
ADD CONSTRAINT "VisionDesignSystemSnapshot_sourceJobId_fkey"
FOREIGN KEY ("sourceJobId") REFERENCES "public"."ImportJob"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."VisionDesignSystemSnapshot"
ADD CONSTRAINT "VisionDesignSystemSnapshot_websiteId_fkey"
FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
