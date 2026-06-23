CREATE TYPE "CollectionStatus" AS ENUM ('pending', 'overdue', 'paid', 'canceled', 'renegotiated');

CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'pix', 'bank_slip', 'credit_card', 'debit_card', 'other');

CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'pending',
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collections_companyId_idx" ON "collections"("companyId");
CREATE INDEX "collections_clientId_idx" ON "collections"("clientId");
CREATE INDEX "collections_status_idx" ON "collections"("status");
CREATE INDEX "collections_dueDate_idx" ON "collections"("dueDate");
CREATE INDEX "collections_deletedAt_idx" ON "collections"("deletedAt");

ALTER TABLE "collections" ADD CONSTRAINT "collections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
