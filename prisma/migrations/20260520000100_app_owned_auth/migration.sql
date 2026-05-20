ALTER TABLE "public"."User"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "email" SET NOT NULL,
  ADD COLUMN "passwordHash" TEXT NOT NULL,
  ADD COLUMN "passwordSalt" TEXT NOT NULL,
  ADD COLUMN "passwordParams" JSONB NOT NULL,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

CREATE TABLE "public"."AuthSession" (
  "id" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "sessionTokenHash" TEXT NOT NULL,
  "activeAccountId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_sessionTokenHash_key" ON "public"."AuthSession"("sessionTokenHash");
CREATE INDEX "AuthSession_userId_idx" ON "public"."AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "public"."AuthSession"("expiresAt");
CREATE INDEX "AuthSession_revokedAt_idx" ON "public"."AuthSession"("revokedAt");
CREATE INDEX "AuthSession_activeAccountId_idx" ON "public"."AuthSession"("activeAccountId");

ALTER TABLE "public"."AuthSession"
  ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
