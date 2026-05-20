-- AlterTable
ALTER TABLE "public"."AccountIntegration" ALTER COLUMN "secretVersion" DROP DEFAULT;
ALTER TABLE "public"."AccountIntegration" ALTER COLUMN "secretVersion" TYPE TEXT USING "secretVersion"::text;
UPDATE "public"."AccountIntegration" SET "secretVersion" = 'v1' WHERE "secretVersion" = '1';
ALTER TABLE "public"."AccountIntegration" ALTER COLUMN "secretVersion" SET DEFAULT 'v1';
