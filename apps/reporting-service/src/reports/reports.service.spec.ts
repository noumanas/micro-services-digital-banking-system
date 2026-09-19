import { ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { createDomainEvent } from "@digital-banking/events";
import { ReportsService } from "./reports.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "alice", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makePrisma() {
  const records = new Map<string, Record<string, unknown>>();
  const ownership = new Map<string, Record<string, unknown>>();

  return {
    accountOwnership: {
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        const key = `${where.tenantId_accountId.tenantId}:${where.tenantId_accountId.accountId}`;
        ownership.set(key, create);
        return create;
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.tenantId_accountId.tenantId}:${where.tenantId_accountId.accountId}`;
        return ownership.get(key) ?? null;
      }),
    },
    transactionRecord: {
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        if (!records.has(where.id)) records.set(where.id, create);
        return records.get(where.id);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const r = { ...records.get(where.id), ...data };
        records.set(where.id, r);
        return r;
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => records.get(where.id) ?? null),
      findMany: jest.fn().mockImplementation(({ where }) =>
        [...records.values()].filter(
          (r) => r.tenantId === where.tenantId && (!where.customerId || r.customerId === where.customerId),
        ),
      ),
    },
    _records: records,
  };
}

describe("ReportsService", () => {
  it("records a debit for the sender and a credit for the receiver once a transfer completes", async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as never);

    await service.handleAccountCreated({ tenantId: "tenant-1", accountId: "acc-bob", customerId: "bob", currency: "USD" });

    const initiated = createDomainEvent({
      eventType: "TransferInitiated",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      producer: "transfer-service",
      aggregateType: "transfer",
      aggregateId: "transfer-1",
      data: {
        transferId: "transfer-1",
        customerId: "alice",
        sourceAccountId: "acc-alice",
        destinationAccountId: "acc-bob",
        amount: 5000,
        currency: "USD",
      },
    });
    await service.handleTransferInitiated(initiated);

    const completed = createDomainEvent({
      eventType: "TransferCompleted",
      tenantId: "tenant-1",
      correlationId: "corr-2",
      producer: "transfer-service",
      aggregateType: "transfer",
      aggregateId: "transfer-1",
      data: { transferId: "transfer-1", customerId: "alice", journalEntryId: "entry-1" },
    });
    await service.handleTransferSettled(completed, "COMPLETED");

    const aliceRecord = prisma._records.get("transfer-1");
    const bobRecord = prisma._records.get("transfer-1:credit");
    expect(aliceRecord).toMatchObject({ direction: "DEBIT", status: "COMPLETED", customerId: "alice" });
    expect(bobRecord).toMatchObject({ direction: "CREDIT", status: "COMPLETED", customerId: "bob", amount: 5000 });
  });

  it("blocks a customer from reading another customer's statement", async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as never);

    await expect(service.statement(makeUser(), "someone-else", 50)).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("summarizes activity by direction and type", async () => {
    const prisma = makePrisma();
    const service = new ReportsService(prisma as never);

    prisma._records.set("t1", {
      tenantId: "tenant-1",
      customerId: "alice",
      type: "TRANSFER",
      direction: "DEBIT",
      amount: 1000,
      status: "COMPLETED",
      occurredAt: new Date(),
    });
    prisma._records.set("t2", {
      tenantId: "tenant-1",
      customerId: "alice",
      type: "PAYMENT",
      direction: "CREDIT",
      amount: 500,
      status: "COMPLETED",
      occurredAt: new Date(),
    });

    const summary = await service.activity(makeUser(), "alice", 30);
    expect(summary.totalDebits).toBe(1000);
    expect(summary.totalCredits).toBe(500);
    expect(summary.transactionCount).toBe(2);
  });
});
