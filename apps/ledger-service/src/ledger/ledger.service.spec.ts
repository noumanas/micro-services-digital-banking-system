import { ConflictDomainError, ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { LedgerService } from "./ledger.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.FINANCE_OFFICER], permissions: [], ...overrides };
}

function makePrisma(accounts: Record<string, unknown>[]) {
  const ledgerAccounts = new Map(accounts.map((a) => [a.id, { ...a }]));
  const lines: Record<string, unknown>[] = [];
  const entries = new Map<string, Record<string, unknown>>();

  const tx = {
    journalEntry: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `entry-${entries.size + 1}`;
        const entryLines = data.lines.create.map((l: Record<string, unknown>, i: number) => ({
          id: `line-${lines.length + i + 1}`,
          journalEntryId: id,
          ...l,
        }));
        lines.push(...entryLines);
        const entry = { id, reversedBy: null, ...data, lines: entryLines };
        entries.set(id, entry);
        // linking: mark the original entry as reversed once its reversal is created
        if (data.reversalOfId) {
          const original = entries.get(data.reversalOfId);
          if (original) original.reversedBy = entry;
        }
        return entry;
      }),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    ledgerAccount: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        for (const acc of ledgerAccounts.values()) {
          if (where.externalAccountId && acc.externalAccountId === where.externalAccountId) return acc;
          if (where.code && acc.code === where.code && acc.currency === where.currency) return acc;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const acc = { id: `sys-${ledgerAccounts.size + 1}`, ...data };
        ledgerAccounts.set(acc.id, acc);
        return acc;
      }),
    },
    journalEntry: {
      findFirst: jest.fn().mockImplementation(({ where }) => entries.get(where.id) ?? null),
    },
    journalLine: {
      aggregate: jest.fn().mockImplementation(({ where }) => {
        const total = lines
          .filter((l) => l.ledgerAccountId === where.ledgerAccountId && l.direction === where.direction)
          .reduce((sum, l) => sum + (l.amount as number), 0);
        return { _sum: { amount: total || null } };
      }),
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
    _lines: lines,
  };
}

describe("LedgerService", () => {
  it("posts a balanced deposit against the external funding account", async () => {
    const prisma = makePrisma([{ id: "acc-1", externalAccountId: "ext-1", customerId: "customer-1", currency: "USD" }]);
    const service = new LedgerService(prisma as never);

    const entry = await service.deposit(makeUser(), "ext-1", { amount: 10000, currency: "USD" }, "corr-1");

    expect(entry.reference).toBe("DEPOSIT");
    const debitTotal = prisma._lines.filter((l) => l.direction === "DEBIT").reduce((s, l) => s + (l.amount as number), 0);
    const creditTotal = prisma._lines.filter((l) => l.direction === "CREDIT").reduce((s, l) => s + (l.amount as number), 0);
    expect(debitTotal).toBe(creditTotal);
    expect(debitTotal).toBe(10000);
  });

  it("refuses a deposit whose currency doesn't match the account", async () => {
    const prisma = makePrisma([{ id: "acc-1", externalAccountId: "ext-1", customerId: "customer-1", currency: "USD" }]);
    const service = new LedgerService(prisma as never);

    await expect(
      service.deposit(makeUser(), "ext-1", { amount: 10000, currency: "EUR" }, "corr-1"),
    ).rejects.toBeInstanceOf(ConflictDomainError);
  });

  it("computes balance as credits minus debits", async () => {
    const prisma = makePrisma([{ id: "acc-1", externalAccountId: "ext-1", customerId: "customer-1", currency: "USD" }]);
    const service = new LedgerService(prisma as never);

    await service.deposit(makeUser(), "ext-1", { amount: 10000, currency: "USD" }, "corr-1");
    const balance = await service.getBalance(makeUser(), "ext-1");

    expect(balance).toEqual({ accountId: "ext-1", currency: "USD", balance: 10000 });
  });

  it("blocks a customer from reading another customer's balance", async () => {
    const prisma = makePrisma([{ id: "acc-1", externalAccountId: "ext-1", customerId: "someone-else", currency: "USD" }]);
    const service = new LedgerService(prisma as never);
    const customer = makeUser({ roles: [Role.CUSTOMER] });

    await expect(service.getBalance(customer, "ext-1")).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("reverses an entry with inverted, balanced lines and refuses to reverse it twice", async () => {
    const prisma = makePrisma([{ id: "acc-1", externalAccountId: "ext-1", customerId: "customer-1", currency: "USD" }]);
    const service = new LedgerService(prisma as never);

    const original = await service.deposit(makeUser(), "ext-1", { amount: 10000, currency: "USD" }, "corr-1");

    const reversal = await service.reverse(makeUser(), original.id, "corr-2");
    expect(reversal.reference).toBe("REVERSAL");
    expect(reversal.reversalOfId).toBe(original.id);

    const balanceAfter = await service.getBalance(makeUser(), "ext-1");
    expect(balanceAfter.balance).toBe(0);

    await expect(service.reverse(makeUser(), original.id, "corr-3")).rejects.toBeInstanceOf(ConflictDomainError);
  });
});
