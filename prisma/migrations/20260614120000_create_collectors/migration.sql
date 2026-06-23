CREATE TABLE "collectors" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappPhone" TEXT,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "collectors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collectors_companyId_email_key" ON "collectors"("companyId", "email");
CREATE INDEX "collectors_companyId_idx" ON "collectors"("companyId");
CREATE INDEX "collectors_active_idx" ON "collectors"("active");
CREATE INDEX "collectors_deletedAt_idx" ON "collectors"("deletedAt");

ALTER TABLE "collectors" ADD CONSTRAINT "collectors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
