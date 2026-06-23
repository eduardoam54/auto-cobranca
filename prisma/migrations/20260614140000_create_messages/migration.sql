CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

CREATE TYPE "MessageChannel" AS ENUM ('whatsapp', 'system', 'manual');

CREATE TYPE "MessageType" AS ENUM ('text', 'audio', 'image', 'document', 'location', 'other');

CREATE TYPE "MessageStatus" AS ENUM ('received', 'sent', 'delivered', 'read', 'failed', 'pending');

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'text',
    "externalMessageId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "aiIntent" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "messages_companyId_externalMessageId_key" ON "messages"("companyId", "externalMessageId");
CREATE INDEX "messages_companyId_idx" ON "messages"("companyId");
CREATE INDEX "messages_clientId_idx" ON "messages"("clientId");
CREATE INDEX "messages_phone_idx" ON "messages"("phone");
CREATE INDEX "messages_direction_idx" ON "messages"("direction");
CREATE INDEX "messages_channel_idx" ON "messages"("channel");
CREATE INDEX "messages_status_idx" ON "messages"("status");
CREATE INDEX "messages_receivedAt_idx" ON "messages"("receivedAt");
CREATE INDEX "messages_sentAt_idx" ON "messages"("sentAt");
CREATE INDEX "messages_aiAnalyzed_idx" ON "messages"("aiAnalyzed");
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");

ALTER TABLE "messages" ADD CONSTRAINT "messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
