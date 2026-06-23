ALTER TABLE "collectors" ADD COLUMN "userId" TEXT;

CREATE INDEX "collectors_userId_idx" ON "collectors"("userId");

CREATE UNIQUE INDEX "collectors_active_userId_key"
ON "collectors"("userId")
WHERE "userId" IS NOT NULL AND "active" = true AND "deletedAt" IS NULL;

ALTER TABLE "collectors"
ADD CONSTRAINT "collectors_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
