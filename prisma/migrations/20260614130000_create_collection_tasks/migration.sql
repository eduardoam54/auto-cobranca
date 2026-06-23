CREATE TYPE "CollectionTaskType" AS ENUM ('presencial_collection', 'whatsapp_followup', 'phone_call', 'payment_confirmation', 'renegotiation_followup', 'other');

CREATE TYPE "CollectionTaskPriority" AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE "CollectionTaskStatus" AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'canceled', 'failed');

CREATE TABLE "collection_tasks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "collectionId" TEXT,
    "collectorId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CollectionTaskType" NOT NULL,
    "priority" "CollectionTaskPriority" NOT NULL DEFAULT 'medium',
    "status" "CollectionTaskStatus" NOT NULL DEFAULT 'pending',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "aiRecommendation" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "collection_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collection_tasks_companyId_idx" ON "collection_tasks"("companyId");
CREATE INDEX "collection_tasks_clientId_idx" ON "collection_tasks"("clientId");
CREATE INDEX "collection_tasks_collectionId_idx" ON "collection_tasks"("collectionId");
CREATE INDEX "collection_tasks_collectorId_idx" ON "collection_tasks"("collectorId");
CREATE INDEX "collection_tasks_priority_idx" ON "collection_tasks"("priority");
CREATE INDEX "collection_tasks_status_idx" ON "collection_tasks"("status");
CREATE INDEX "collection_tasks_scheduledDate_idx" ON "collection_tasks"("scheduledDate");
CREATE INDEX "collection_tasks_deletedAt_idx" ON "collection_tasks"("deletedAt");

ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "collection_tasks" ADD CONSTRAINT "collection_tasks_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "collectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
