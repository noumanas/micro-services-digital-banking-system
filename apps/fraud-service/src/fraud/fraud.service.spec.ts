import { ConfigService } from "@nestjs/config";
import { createDomainEvent } from "@digital-banking/events";
import { FraudService } from "./fraud.service";

function makePrisma(existingChecks: Record<string, unknown>[] = []) {
  const checks = [...existingChecks];
  const tx = {
    fraudCheck: {
      create: jest.fn().mockImplementation(({ data }) => {
        checks.push(data);
        return data;
      }),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    fraudCheck: {
      findUnique: jest.fn().mockImplementation(({ where }) => checks.find((c) => c.transferId === where.transferId) ?? null),
      count: jest.fn().mockImplementation(({ where }) => checks.filter((c) => c.sourceAccountId === where.sourceAccountId).length),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(tx)),
    tx,
    _checks: checks,
  };
}

function makeConfig(overrides: Record<string, number> = {}) {
  const defaults: Record<string, number> = {
    FRAUD_BLOCK_THRESHOLD: 5_000_000,
    FRAUD_FLAG_THRESHOLD: 1_000_000,
    FRAUD_VELOCITY_WINDOW_MINUTES: 10,
    FRAUD_VELOCITY_MAX_COUNT: 5,
    ...overrides,
  };
  return { get: (key: string, fallback: number) => defaults[key] ?? fallback } as unknown as ConfigService;
}

function transferInitiated(overrides: Partial<{ transferId: string; sourceAccountId: string; amount: number }> = {}) {
  return createDomainEvent({
    eventType: "TransferInitiated",
    tenantId: "tenant-1",
    correlationId: "corr-1",
    producer: "transfer-service",
    aggregateType: "transfer",
    aggregateId: overrides.transferId ?? "transfer-1",
    data: {
      transferId: overrides.transferId ?? "transfer-1",
      sourceAccountId: overrides.sourceAccountId ?? "acc-1",
      destinationAccountId: "acc-2",
      amount: overrides.amount ?? 1000,
      currency: "USD",
    },
  });
}

describe("FraudService", () => {
  it("approves a small, isolated transfer", async () => {
    const prisma = makePrisma();
    const service = new FraudService(prisma as never, makeConfig());

    await service.evaluateTransfer(transferInitiated({ amount: 1000 }));

    expect(prisma.tx.fraudCheck.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decision: "APPROVED" }) }),
    );
    expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "TransferApproved" }) }),
    );
  });

  it("blocks a transfer over the block threshold", async () => {
    const prisma = makePrisma();
    const service = new FraudService(prisma as never, makeConfig({ FRAUD_BLOCK_THRESHOLD: 1000 }));

    await service.evaluateTransfer(transferInitiated({ amount: 5000 }));

    expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "TransferBlocked" }) }),
    );
  });

  it("flags a transfer that exceeds the velocity limit", async () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({
      transferId: `prior-${i}`,
      sourceAccountId: "acc-1",
    }));
    const prisma = makePrisma(existing);
    const service = new FraudService(prisma as never, makeConfig({ FRAUD_VELOCITY_MAX_COUNT: 5 }));

    await service.evaluateTransfer(transferInitiated({ transferId: "transfer-new", amount: 100 }));

    expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "TransferFlagged" }) }),
    );
  });

  it("is idempotent — replaying the same event does not create a second check", async () => {
    const prisma = makePrisma();
    const service = new FraudService(prisma as never, makeConfig());
    const event = transferInitiated({ transferId: "transfer-dup" });

    await service.evaluateTransfer(event);
    await service.evaluateTransfer(event);

    expect(prisma.tx.fraudCheck.create).toHaveBeenCalledTimes(1);
  });
});
