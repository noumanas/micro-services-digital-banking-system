-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dailyLimit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "declineReason" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_transactions_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "cards_tenantId_customerId_idx" ON "cards"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "card_transactions_cardId_createdAt_idx" ON "card_transactions"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_published_createdAt_idx" ON "outbox_events"("published", "createdAt");

-- AddForeignKey
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
