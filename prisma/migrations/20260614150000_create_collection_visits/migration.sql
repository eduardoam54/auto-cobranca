CREATE TYPE "CollectionVisitResult" AS ENUM ('paid', 'partial_paid', 'not_home', 'refused_payment', 'promised_payment', 'wrong_address', 'rescheduled', 'other');

CREATE TABLE "collection_visits" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "collectionId" TEXT,
    "collectorId" TEXT,
    "result" "CollectionVisitResult" NOT NULL,
    "notes" TEXT,
    "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "paymentAmount" DECIMAL(12,2),
    "paymentMethod" "PaymentMethod",
    "receiptUrl" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "collection_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collection_visits_companyId_idx" ON "collection_visits"("companyId");
CREATE INDEX "collection_visits_taskId_idx" ON "collection_visits"("taskId");
CREATE INDEX "collection_visits_clientId_idx" ON "collection_visits"("clientId");
CREATE INDEX "collection_visits_collectionId_idx" ON "collection_visits"("collectionId");
CREATE INDEX "collection_visits_collectorId_idx" ON "collection_visits"("collectorId");
CREATE INDEX "collection_visits_result_idx" ON "collection_visits"("result");
CREATE INDEX "collection_visits_visitedAt_idx" ON "collection_visits"("visitedAt");
CREATE INDEX "collection_visits_deletedAt_idx" ON "collection_visits"("deletedAt");

ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "collection_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "collection_visits" ADD CONSTRAINT "collection_visits_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
