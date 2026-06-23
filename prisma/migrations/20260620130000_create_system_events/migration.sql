CREATE TYPE "SystemEventSource" AS ENUM ('whatsapp', 'ai', 'web', 'mobile', 'system');

CREATE TYPE "SystemEventType" AS ENUM (
    'whatsapp_webhook_verified',
    'whatsapp_message_received',
    'whatsapp_message_duplicated',
    'whatsapp_message_skipped',
    'ai_analysis_started',
    'ai_analysis_completed',
    'ai_analysis_failed',
    'ai_task_created',
    'ai_task_duplicate_detected',
    'ai_task_not_created',
    'task_assigned',
    'task_started',
    'task_completed',
    'task_failed',
    'payment_registered',
    'manual_action'
);

CREATE TYPE "SystemEventStatus" AS ENUM ('success', 'warning', 'failed');

CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "collectionId" TEXT,
    "taskId" TEXT,
    "messageId" TEXT,
    "actorUserId" TEXT,
    "source" "SystemEventSource" NOT NULL,
    "type" "SystemEventType" NOT NULL,
    "status" "SystemEventStatus" NOT NULL DEFAULT 'success',
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "system_events_companyId_idx" ON "system_events"("companyId");
CREATE INDEX "system_events_clientId_idx" ON "system_events"("clientId");
CREATE INDEX "system_events_collectionId_idx" ON "system_events"("collectionId");
CREATE INDEX "system_events_taskId_idx" ON "system_events"("taskId");
CREATE INDEX "system_events_messageId_idx" ON "system_events"("messageId");
CREATE INDEX "system_events_actorUserId_idx" ON "system_events"("actorUserId");
CREATE INDEX "system_events_source_idx" ON "system_events"("source");
CREATE INDEX "system_events_type_idx" ON "system_events"("type");
CREATE INDEX "system_events_status_idx" ON "system_events"("status");
CREATE INDEX "system_events_occurredAt_idx" ON "system_events"("occurredAt");

ALTER TABLE "system_events" ADD CONSTRAINT "system_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "collection_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
