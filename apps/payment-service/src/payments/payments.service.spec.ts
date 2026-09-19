import { ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PaymentsService } from "./payments.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";
import { PaymentProviderAdapter } from "../provider/payment-provider.adapter";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makePrisma(ownership: Record<string, unknown>[]) {
  const ownershipMap = new Map(ownership.map((o) => [`${o.tenantId}:${o.accountId}`, o]));
  const payments = new Map<string, Record<string, unknown>>();

  const tx = {
    payment: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `payment-${payments.size + 1}`;
        const p = { id, ...data };
        payments.set(id, p);
        return p;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const p = { ...payments.get(where.id), ...data };
        payments.set(where.id, p);
        return p;
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
    payment: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (!where.tenantId_idempotencyKey) return null;
        const { idempotencyKey } = where.tenantId_idempotencyKey;
        return [...payments.values()].find((p) => p.idempotencyKey === idempotencyKey) ?? null;
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => payments.get(where.id) ?? null),
      update: tx.payment.update,
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
    _payments: payments,
  };
}

const OWNERSHIP = [{ tenantId: "tenant-1", accountId: "acc-1", customerId: "customer-1", currency: "USD" }];

describe("PaymentsService", () => {
  it("completes an INBOUND payment: authorized, deposited, COMPLETED", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postDeposit: jest.fn().mockResolvedValue({ id: "entry-1" }) } as unknown as LedgerClientService;
    const provider: PaymentProviderAdapter = { authorize: jest.fn().mockResolvedValue({ approved: true, reason: "ok" }) };
    const service = new PaymentsService(prisma as never, ledgerClient, provider);

    const payment = await service.create(
      makeUser(),
      { accountId: "acc-1", direction: "INBOUND", amount: 1000, currency: "USD" },
      "key-1",
      "corr-1",
    );

    expect(payment.status).toBe("COMPLETED");
    expect(ledgerClient.postDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc-1", amount: 1000 }),
    );
  });

  it("fails the payment when the provider declines, without touching the ledger", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postDeposit: jest.fn(), postWithdrawal: jest.fn() } as unknown as LedgerClientService;
    const provider: PaymentProviderAdapter = {
      authorize: jest.fn().mockResolvedValue({ approved: false, reason: "declined" }),
    };
    const service = new PaymentsService(prisma as never, ledgerClient, provider);

    const payment = await service.create(
      makeUser(),
      { accountId: "acc-1", direction: "OUTBOUND", amount: 1000, currency: "USD", simulate: "decline" },
      "key-2",
      "corr-1",
    );

    expect(payment.status).toBe("FAILED");
    expect(ledgerClient.postWithdrawal).not.toHaveBeenCalled();
  });

  it("is idempotent — the same key never authorizes twice", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postDeposit: jest.fn().mockResolvedValue({ id: "entry-1" }) } as unknown as LedgerClientService;
    const provider: PaymentProviderAdapter = { authorize: jest.fn().mockResolvedValue({ approved: true, reason: "ok" }) };
    const service = new PaymentsService(prisma as never, ledgerClient, provider);

    const dto = { accountId: "acc-1", direction: "INBOUND" as const, amount: 1000, currency: "USD" };
    const first = await service.create(makeUser(), dto, "key-3", "corr-1");
    const second = await service.create(makeUser(), dto, "key-3", "corr-2");

    expect(second.id).toBe(first.id);
    expect(provider.authorize).toHaveBeenCalledTimes(1);
  });

  it("refuses to initiate a payment on another customer's account", async () => {
    const prisma = makePrisma(OWNERSHIP);
    const ledgerClient = { postDeposit: jest.fn() } as unknown as LedgerClientService;
    const provider: PaymentProviderAdapter = { authorize: jest.fn() };
    const service = new PaymentsService(prisma as never, ledgerClient, provider);

    await expect(
      service.create(
        makeUser({ userId: "someone-else" }),
        { accountId: "acc-1", direction: "INBOUND", amount: 1000, currency: "USD" },
        "key-4",
        "corr-1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
    expect(provider.authorize).not.toHaveBeenCalled();
  });
});
