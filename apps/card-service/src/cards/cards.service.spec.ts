import { ConflictDomainError, ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { ConfigService } from "@nestjs/config";
import { CardsService } from "./cards.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makeConfig() {
  return { get: (_key: string, fallback: number) => fallback } as unknown as ConfigService;
}

function makePrisma(ownership: Record<string, unknown>[], cards: Record<string, unknown>[] = []) {
  const ownershipMap = new Map(ownership.map((o) => [`${o.tenantId}:${o.accountId}`, o]));
  const cardMap = new Map(cards.map((c) => [c.id as string, c]));
  const transactions: Record<string, unknown>[] = [];

  const tx = {
    card: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `card-${cardMap.size + 1}`;
        const c = { id, ...data };
        cardMap.set(id, c);
        return c;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const c = { ...cardMap.get(where.id), ...data };
        cardMap.set(where.id, c);
        return c;
      }),
    },
    cardTransaction: {
      create: jest.fn().mockImplementation(({ data }) => {
        const t = { id: `txn-${transactions.length + 1}`, ...data };
        transactions.push(t);
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
    },
    card: {
      findFirst: jest.fn().mockImplementation(({ where }) => cardMap.get(where.id) ?? null),
      findUnique: jest.fn().mockImplementation(({ where }) => cardMap.get(where.id) ?? null),
      update: tx.card.update,
    },
    cardTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
    _cards: cardMap,
    _transactions: transactions,
  };
}

const OWNERSHIP = [{ tenantId: "tenant-1", accountId: "acc-1", customerId: "customer-1", currency: "USD" }];

describe("CardsService", () => {
  it("issues a PENDING card and activates it", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postWithdrawal: jest.fn() } as unknown as LedgerClientService;
    const service = new CardsService(prisma as never, ledgerClient, makeConfig());

    const card = await service.issue(makeUser(), { accountId: "acc-1", type: "VIRTUAL" }, "corr-1");
    expect(card.status).toBe("PENDING");

    const activated = await service.activate(makeUser(), card.id, "corr-2");
    expect(activated.status).toBe("ACTIVE");
  });

  it("refuses to issue a card against an account you don't own", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postWithdrawal: jest.fn() } as unknown as LedgerClientService;
    const service = new CardsService(prisma as never, ledgerClient, makeConfig());

    await expect(
      service.issue(makeUser({ userId: "someone-else" }), { accountId: "acc-1", type: "VIRTUAL" }, "corr-1"),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("declines a transaction against a card that isn't active, without touching the ledger", async () => {
    const prisma = makePrisma(OWNERSHIP, [
      { id: "card-1", tenantId: "tenant-1", customerId: "customer-1", accountId: "acc-1", status: "PENDING", dailyLimit: 500_000 },
    ]);
    const ledgerClient = { postWithdrawal: jest.fn() } as unknown as LedgerClientService;
    const service = new CardsService(prisma as never, ledgerClient, makeConfig());

    const result = await service.receiveTransaction(
      "card-1",
      { amount: 1000, currency: "USD", merchantName: "Test Store" },
      "corr-1",
    );

    expect(result.status).toBe("DECLINED");
    expect(ledgerClient.postWithdrawal).not.toHaveBeenCalled();
  });

  it("approves and posts a transaction against an active card within limit", async () => {
    const prisma = makePrisma(OWNERSHIP, [
      { id: "card-1", tenantId: "tenant-1", customerId: "customer-1", accountId: "acc-1", status: "ACTIVE", dailyLimit: 500_000 },
    ]);
    const ledgerClient = { postWithdrawal: jest.fn().mockResolvedValue({ id: "entry-1" }) } as unknown as LedgerClientService;
    const service = new CardsService(prisma as never, ledgerClient, makeConfig());

    const result = await service.receiveTransaction(
      "card-1",
      { amount: 1000, currency: "USD", merchantName: "Test Store" },
      "corr-1",
    );

    expect(result.status).toBe("APPROVED");
    expect(ledgerClient.postWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ accountId: "acc-1", amount: 1000 }));
  });

  it("cannot block an already-blocked card", async () => {
    const prisma = makePrisma(OWNERSHIP, [
      { id: "card-1", tenantId: "tenant-1", customerId: "customer-1", accountId: "acc-1", status: "BLOCKED", dailyLimit: 500_000 },
    ]);
    const ledgerClient = { postWithdrawal: jest.fn() } as unknown as LedgerClientService;
    const service = new CardsService(prisma as never, ledgerClient, makeConfig());

    await expect(service.block(makeUser(), "card-1", "corr-1")).rejects.toBeInstanceOf(ConflictDomainError);
  });
});
