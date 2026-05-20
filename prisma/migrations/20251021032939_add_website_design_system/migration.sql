-- AlterTable
ALTER TABLE "public"."WebsiteMedia" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."WebsiteMediaSource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."WebsiteMediaUsage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."WebsiteDesignSystem" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "tokens" JSONB NOT NULL,
    "sourceJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDesignSystem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteDesignSystem_websiteId_idx" ON "public"."WebsiteDesignSystem"("websiteId");

-- CreateIndex
CREATE INDEX "WebsiteDesignSystem_sourceJobId_idx" ON "public"."WebsiteDesignSystem"("sourceJobId");

-- AddForeignKey
ALTER TABLE "public"."WebsiteDesignSystem" ADD CONSTRAINT "WebsiteDesignSystem_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "public"."Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebsiteDesignSystem" ADD CONSTRAINT "WebsiteDesignSystem_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "public"."ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
