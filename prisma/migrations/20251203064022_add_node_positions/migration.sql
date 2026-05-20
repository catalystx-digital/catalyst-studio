/*
  Warnings:

  - You are about to drop the column `metadata` on the `ImportJob` table. All the data in the column will be lost.
  - You are about to drop the `PostImportDirective` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VisionDesignSystemSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PostImportDirective" DROP CONSTRAINT "PostImportDirective_importJobId_fkey";

-- DropForeignKey
ALTER TABLE "PostImportDirective" DROP CONSTRAINT "PostImportDirective_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "VisionDesignSystemSnapshot" DROP CONSTRAINT "VisionDesignSystemSnapshot_cssDesignSystemId_fkey";

-- DropForeignKey
ALTER TABLE "VisionDesignSystemSnapshot" DROP CONSTRAINT "VisionDesignSystemSnapshot_sourceJobId_fkey";

-- DropForeignKey
ALTER TABLE "VisionDesignSystemSnapshot" DROP CONSTRAINT "VisionDesignSystemSnapshot_websiteId_fkey";

-- DropForeignKey
ALTER TABLE "WebsiteDesignConcept" DROP CONSTRAINT "WebsiteDesignConcept_websiteId_fkey";

-- AlterTable
ALTER TABLE "ImportJob" DROP COLUMN "metadata";

-- DropTable
DROP TABLE "PostImportDirective";

-- DropTable
DROP TABLE "VisionDesignSystemSnapshot";

-- DropEnum
DROP TYPE "PostImportDirectiveStatus";

-- CreateTable
CREATE TABLE "node_positions" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 280,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "gridCellX" INTEGER NOT NULL,
    "gridCellY" INTEGER NOT NULL,
    "pageTitle" TEXT,
    "pageSlug" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "pathDepth" INTEGER NOT NULL,
    "layoutVersion" TEXT NOT NULL DEFAULT '1.0',
    "layoutHash" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_positions_structureId_key" ON "node_positions"("structureId");

-- CreateIndex
CREATE INDEX "idx_spatial_grid" ON "node_positions"("websiteId", "gridCellX", "gridCellY");

-- CreateIndex
CREATE INDEX "idx_position_x" ON "node_positions"("websiteId", "x");

-- CreateIndex
CREATE INDEX "idx_position_y" ON "node_positions"("websiteId", "y");

-- CreateIndex
CREATE INDEX "idx_depth" ON "node_positions"("websiteId", "pathDepth");

-- CreateIndex
CREATE INDEX "idx_structure" ON "node_positions"("structureId");

-- AddForeignKey
ALTER TABLE "WebsiteDesignConcept" ADD CONSTRAINT "WebsiteDesignConcept_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_positions" ADD CONSTRAINT "node_positions_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_positions" ADD CONSTRAINT "node_positions_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "WebsiteStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
