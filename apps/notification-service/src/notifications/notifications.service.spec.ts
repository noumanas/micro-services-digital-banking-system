import { createDomainEvent } from "@digital-banking/events";
import { NotificationsService } from "./notifications.service";
import { NotificationProviderAdapter } from "../provider/notification-provider.adapter";

function makePrisma() {
  const logs: Record<string, unknown>[] = [];
  return {
    notificationLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        logs.push(data);
        return data;
      }),
      findMany: jest.fn().mockImplementation(({ where }) => logs.filter((l) => l.customerId === where.customerId)),
    },
    _logs: logs,
  };
}

describe("NotificationsService", () => {
  it("sends via the provider and logs a SENT record", async () => {
    const prisma = makePrisma();
    const provider: NotificationProviderAdapter = { send: jest.fn().mockResolvedValue({ sent: true }) };
    const service = new NotificationsService(prisma as never, provider);

    const event = createDomainEvent({
      eventType: "TransferCompleted",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      producer: "transfer-service",
      aggregateType: "transfer",
      aggregateId: "transfer-1",
      data: { transferId: "transfer-1", customerId: "customer-1", journalEntryId: "entry-1" },
    });

    await service.handleEvent(event);

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ recipientCustomerId: "customer-1", channel: "EMAIL" }),
    );
    expect(prisma._logs[0]).toMatchObject({ status: "SENT", eventType: "TransferCompleted", customerId: "customer-1" });
  });

  it("logs FAILED, but does not throw, when the provider errors", async () => {
    const prisma = makePrisma();
    const provider: NotificationProviderAdapter = { send: jest.fn().mockRejectedValue(new Error("smtp down")) };
    const service = new NotificationsService(prisma as never, provider);

    const event = createDomainEvent({
      eventType: "KycApproved",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      producer: "kyc-service",
      aggregateType: "kyc-verification",
      aggregateId: "kyc-1",
      data: { customerId: "customer-1" },
    });

    await expect(service.handleEvent(event)).resolves.toBeUndefined();
    expect(prisma._logs[0]).toMatchObject({ status: "FAILED" });
  });

  it("skips events with no customerId instead of crashing", async () => {
    const prisma = makePrisma();
    const provider: NotificationProviderAdapter = { send: jest.fn() };
    const service = new NotificationsService(prisma as never, provider);

    const event = createDomainEvent({
      eventType: "SomeEventWithoutCustomer",
      tenantId: "tenant-1",
      correlationId: "corr-1",
      producer: "x",
      aggregateType: "x",
      aggregateId: "x",
      data: {},
    });

    await service.handleEvent(event);
    expect(provider.send).not.toHaveBeenCalled();
    expect(prisma._logs).toHaveLength(0);
  });
});
