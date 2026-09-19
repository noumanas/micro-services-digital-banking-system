import { ConflictDomainError, ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { AccountsService } from "./accounts.service";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makePrisma(kycApproved: boolean, account: Record<string, unknown> | null = null) {
  let current = account;

  const tx = {
    account: {
      create: jest.fn().mockImplementation(({ data }) => {
        current = { id: "account-1", status: "PENDING_ACTIVATION", ...data };
        return current;
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        current = { ...current, ...data };
        return current;
      }),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    customerKycStatus: {
      findUnique: jest.fn().mockResolvedValue(kycApproved ? { approved: true } : null),
    },
    account: {
      findFirst: jest.fn().mockImplementation(() => current),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
  };
}

describe("AccountsService", () => {
  it("refuses to create an account before KYC is approved", async () => {
    const prisma = makePrisma(false);
    const service = new AccountsService(prisma as never);

    await expect(
      service.create(makeUser(), { customerId: "customer-1", type: "CURRENT", currency: "USD" }, "corr-1"),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("creates a PENDING_ACTIVATION account and emits AccountCreated once KYC is approved", async () => {
    const prisma = makePrisma(true);
    const service = new AccountsService(prisma as never);

    const account = await service.create(
      makeUser(),
      { customerId: "customer-1", type: "CURRENT", currency: "USD" },
      "corr-1",
    );

    expect(account.status).toBe("PENDING_ACTIVATION");
    expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "AccountCreated" }) }),
    );
  });

  it("refuses to freeze an account that is not active", async () => {
    const prisma = makePrisma(true, {
      id: "account-1",
      tenantId: "tenant-1",
      customerId: "customer-1",
      status: "PENDING_ACTIVATION",
    });
    const service = new AccountsService(prisma as never);

    await expect(service.freeze(makeUser(), "account-1", "corr-1")).rejects.toBeInstanceOf(ConflictDomainError);
  });
});
