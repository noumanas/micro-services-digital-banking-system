-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_ownership" (
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_ownership_pkey" PRIMARY KEY ("tenantId","accountId")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letters" (
    "id" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "eventId" TEXT,
    "eventType" TEXT,
    "payload" JSONB,
    "rawValue" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_tenantId_customerId_createdAt_idx" ON "payments"("tenantId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_idempotencyKey_key" ON "payments"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "outbox_events_published_createdAt_idx" ON "outbox_events"("published", "createdAt");
