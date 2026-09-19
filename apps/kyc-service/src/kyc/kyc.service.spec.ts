import { ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { KycService } from "./kyc.service";
import { KycProviderAdapter } from "../provider/kyc-provider.adapter";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: "customer-1", tenantId: "tenant-1", roles: [Role.CUSTOMER], permissions: [], ...overrides };
}

function makePrisma() {
  let verification = { id: "kyc-1", tenantId: "tenant-1", customerId: "customer-1", status: "PENDING" };

  const tx = {
    kycVerification: {
      create: jest.fn().mockImplementation(({ data }) => {
        verification = { id: "kyc-1", ...data };
        return verification;
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        verification = { ...verification, ...data };
        return verification;
      }),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
  };
}

describe("KycService", () => {
  it("approves when the provider approves, emitting KycApproved", async () => {
    const prisma = makePrisma();
    const provider: KycProviderAdapter = {
      verify: jest.fn().mockResolvedValue({ approved: true, reason: "ok" }),
    };
    const service = new KycService(prisma as never, provider);

    const result = await service.create(makeUser(), { customerId: "customer-1" }, "corr-1");

    expect(result.status).toBe("APPROVED");
    expect(provider.verify).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", customerId: "customer-1" }),
    );
    const outboxCalls = prisma.tx.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType);
    expect(outboxCalls).toEqual(["KycVerificationRequested", "KycApproved"]);
  });

  it("rejects when the provider rejects, emitting KycRejected", async () => {
    const prisma = makePrisma();
    const provider: KycProviderAdapter = {
      verify: jest.fn().mockResolvedValue({ approved: false, reason: "simulated rejection" }),
    };
    const service = new KycService(prisma as never, provider);

    const result = await service.create(makeUser(), { customerId: "customer-1", simulate: "reject" }, "corr-1");

    expect(result.status).toBe("REJECTED");
    const outboxCalls = prisma.tx.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType);
    expect(outboxCalls).toEqual(["KycVerificationRequested", "KycRejected"]);
  });

  it("blocks a customer from submitting verification on behalf of someone else", async () => {
    const prisma = makePrisma();
    const provider: KycProviderAdapter = { verify: jest.fn() };
    const service = new KycService(prisma as never, provider);

    await expect(
      service.create(makeUser(), { customerId: "someone-else" }, "corr-1"),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
    expect(provider.verify).not.toHaveBeenCalled();
  });
});
