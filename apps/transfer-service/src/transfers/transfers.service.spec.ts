import { ConfigService } from "@nestjs/config";
import { ConflictDomainError, ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { createDomainEvent } from "@digital-banking/events";
import { TransfersService } from "./transfers.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makeConfig(overrides: Record<string, number> = {}) {
  const defaults: Record<string, number> = { DAILY_TRANSFER_LIMIT: 1_000_000, ...overrides };
  return { get: (key: string, fallback: number) => defaults[key] ?? fallback } as unknown as ConfigService;
}

function makePrisma(ownership: Record<string, unknown>[]) {
  const ownershipMap = new Map(ownership.map((o) => [`${o.tenantId}:${o.accountId}`, o]));
  const transfers = new Map<string, Record<string, unknown>>();

  const tx = {
    transfer: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `transfer-${transfers.size + 1}`;
        const t = { id, ...data };
        transfers.set(id, t);
        return t;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const t = { ...transfers.get(where.id), ...data };
        transfers.set(where.id, t);
        return t;
      }),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    accountOwnership: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.tenantId_accountId.tenantId}:${where.tenantId_accountId.accountId}`;
        return ownershipMap.get(key) ?? null;
      }),
      upsert: jest.fn(),
    },
    transfer: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return transfers.get(where.id) ?? null;
        if (where.tenantId_idempotencyKey) {
          const { idempotencyKey } = where.tenantId_idempotencyKey;
          return [...transfers.values()].find((t) => t.idempotencyKey === idempotencyKey) ?? null;
        }
        return null;
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => transfers.get(where.id) ?? null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
    _transfers: transfers,
  };
}

const OWNERSHIP = [
  { tenantId: "tenant-1", accountId: "acc-source", customerId: "customer-1", currency: "USD" },
  { tenantId: "tenant-1", accountId: "acc-dest", customerId: "customer-2", currency: "USD" },
];

describe("TransfersService", () => {
  it("is idempotent — the same key returns the same transfer without creating a second one", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postTransfer: jest.fn() } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig());

    const dto = { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" };
    const first = await service.create(makeUser(), dto, "key-1", "corr-1");
    const second = await service.create(makeUser(), dto, "key-1", "corr-2");

    expect(second.id).toBe(first.id);
    expect(prisma.tx.transfer.create).toHaveBeenCalledTimes(1);
  });

  it("refuses to transfer from an account you don't own", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postTransfer: jest.fn() } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig());

    await expect(
      service.create(
        makeUser({ userId: "someone-else" }),
        { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" },
        "key-2",
        "corr-1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("completes the saga: fraud-approved transfer posts to the ledger and finishes COMPLETED", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = {
      postTransfer: jest.fn().mockResolvedValue({ id: "journal-entry-1" }),
    } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig());

    const transfer = await service.create(
      makeUser(),
      { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" },
      "key-3",
      "corr-1",
    );

    const approvedEvent = createDomainEvent({
      eventType: "TransferApproved",
      tenantId: "tenant-1",
      correlationId: "corr-2",
      producer: "fraud-service",
      aggregateType: "transfer",
      aggregateId: transfer.id,
      data: { transferId: transfer.id, decision: "APPROVED" as const, reason: "ok" },
    });

    await service.handleFraudDecision(approvedEvent);

    expect(ledgerClient.postTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000 }),
    );
    const finalTransfer = prisma._transfers.get(transfer.id);
    expect(finalTransfer!.status).toBe("COMPLETED");
    expect(finalTransfer!.journalEntryId).toBe("journal-entry-1");
  });

  it("fails the transfer when fraud blocks it, without ever calling the ledger", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postTransfer: jest.fn() } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig());

    const transfer = await service.create(
      makeUser(),
      { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" },
      "key-4",
      "corr-1",
    );

    const blockedEvent = createDomainEvent({
      eventType: "TransferBlocked",
      tenantId: "tenant-1",
      correlationId: "corr-2",
      producer: "fraud-service",
      aggregateType: "transfer",
      aggregateId: transfer.id,
      data: { transferId: transfer.id, decision: "BLOCKED" as const, reason: "amount too large" },
    });

    await service.handleFraudDecision(blockedEvent);

    expect(ledgerClient.postTransfer).not.toHaveBeenCalled();
    expect(prisma._transfers.get(transfer.id)!.status).toBe("FAILED");
  });

  it("fails the transfer when the daily limit would be exceeded", async () => {
    const prisma = makePrisma(OWNERSHIP);
    prisma.transfer.aggregate = jest.fn().mockResolvedValue({ _sum: { amount: 999_500 } });
    const ledgerClient = { postTransfer: jest.fn() } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig({ DAILY_TRANSFER_LIMIT: 1_000_000 }));

    const transfer = await service.create(
      makeUser(),
      { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" },
      "key-5",
      "corr-1",
    );

    const approvedEvent = createDomainEvent({
      eventType: "TransferApproved",
      tenantId: "tenant-1",
      correlationId: "corr-2",
      producer: "fraud-service",
      aggregateType: "transfer",
      aggregateId: transfer.id,
      data: { transferId: transfer.id, decision: "APPROVED" as const, reason: "ok" },
    });

    await service.handleFraudDecision(approvedEvent);

    expect(ledgerClient.postTransfer).not.toHaveBeenCalled();
    expect(prisma._transfers.get(transfer.id)!.status).toBe("FAILED");
    expect(prisma._transfers.get(transfer.id)!.failureReason).toMatch(/limit/i);
  });

  it("rejects a currency mismatch between source and destination", async () => {
    const prisma = makePrisma([
      { tenantId: "tenant-1", accountId: "acc-source", customerId: "customer-1", currency: "USD" },
      { tenantId: "tenant-1", accountId: "acc-dest", customerId: "customer-2", currency: "EUR" },
    ]);
    const ledgerClient = { postTransfer: jest.fn() } as unknown as LedgerClientService;
    const service = new TransfersService(prisma as never, ledgerClient, makeConfig());

    await expect(
      service.create(
        makeUser(),
        { sourceAccountId: "acc-source", destinationAccountId: "acc-dest", amount: 1000, currency: "USD" },
        "key-6",
        "corr-1",
      ),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });
});
