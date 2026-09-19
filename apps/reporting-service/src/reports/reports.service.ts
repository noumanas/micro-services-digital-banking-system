import { Injectable, Logger } from "@nestjs/common";
import { DomainEvent } from "@digital-banking/events";
import { ForbiddenDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";

function assertCanAccess(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && customerId !== user.userId) {
    throw new ForbiddenDomainError("Cannot access another customer's reports");
  }
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleAccountCreated(input: {
    tenantId: string;
    accountId: string;
    customerId: string;
    currency: string;
  }): Promise<void> {
    await this.prisma.accountOwnership.upsert({
      where: { tenantId_accountId: { tenantId: input.tenantId, accountId: input.accountId } },
      create: {
        tenantId: input.tenantId,
        accountId: input.accountId,
        customerId: input.customerId,
        currency: input.currency,
      },
      update: { customerId: input.customerId, currency: input.currency },
    });
  }

  async handleTransferInitiated(
    event: DomainEvent<{
      transferId: string;
      customerId: string;
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      currency: string;
    }>,
  ): Promise<void> {
    const { transferId, customerId, destinationAccountId, amount, currency } = event.data;
    await this.prisma.transactionRecord.upsert({
      where: { id: transferId },
      create: {
        id: transferId,
        tenantId: event.tenantId,
        customerId,
        type: "TRANSFER",
        direction: "DEBIT",
        amount,
        currency,
        status: "PENDING",
        description: "Transfer sent",
        destinationAccountId,
        occurredAt: new Date(event.occurredAt),
      },
      update: {},
    });
  }

  async handleTransferSettled(
    event: DomainEvent<{ transferId: string; customerId: string; reason?: string }>,
    status: "COMPLETED" | "FAILED",
  ): Promise<void> {
    const { transferId, reason } = event.data;
    const record = await this.prisma.transactionRecord.findUnique({ where: { id: transferId } });
    if (!record) {
      this.logger.warn(`Transfer settlement for unknown record ${transferId}`);
      return;
    }
    if (record.status !== "PENDING") {
      return; // idempotent replay
    }

    await this.prisma.transactionRecord.update({
      where: { id: transferId },
      data: { status, description: reason ? `${record.description} — ${reason}` : record.description },
    });

    if (status !== "COMPLETED" || !record.destinationAccountId) return;

    // Give the receiving customer a CREDIT record too, resolved via our own
    // AccountOwnership read-model — never a live call to account-service.
    const destination = await this.prisma.accountOwnership.findUnique({
      where: { tenantId_accountId: { tenantId: record.tenantId, accountId: record.destinationAccountId } },
    });
    if (!destination) return;

    await this.prisma.transactionRecord.upsert({
      where: { id: `${transferId}:credit` },
      create: {
        id: `${transferId}:credit`,
        tenantId: record.tenantId,
        customerId: destination.customerId,
        type: "TRANSFER",
        direction: "CREDIT",
        amount: record.amount,
        currency: record.currency,
        status: "COMPLETED",
        description: "Transfer received",
        occurredAt: record.occurredAt,
      },
      update: {},
    });
  }

  async handlePaymentInitiated(
    event: DomainEvent<{ paymentId: string; customerId: string; direction: "INBOUND" | "OUTBOUND"; amount: number; currency: string }>,
  ): Promise<void> {
    const { paymentId, customerId, direction, amount, currency } = event.data;
    await this.prisma.transactionRecord.upsert({
      where: { id: paymentId },
      create: {
        id: paymentId,
        tenantId: event.tenantId,
        customerId,
        type: "PAYMENT",
        direction: direction === "INBOUND" ? "CREDIT" : "DEBIT",
        amount,
        currency,
        status: "PENDING",
        occurredAt: new Date(event.occurredAt),
      },
      update: {},
    });
  }

  async handlePaymentSettled(
    event: DomainEvent<{ paymentId: string }>,
    status: "COMPLETED" | "FAILED",
  ): Promise<void> {
    const { paymentId } = event.data;
    const record = await this.prisma.transactionRecord.findUnique({ where: { id: paymentId } });
    if (!record || record.status !== "PENDING") return;
    await this.prisma.transactionRecord.update({ where: { id: paymentId }, data: { status } });
  }

  async handleCardTransaction(
    event: DomainEvent<{
      transactionId: string;
      customerId: string;
      status: "APPROVED" | "DECLINED";
      amount?: number;
      currency?: string;
    }>,
  ): Promise<void> {
    const { transactionId, customerId, status, amount, currency } = event.data;
    if (status !== "APPROVED" || !amount || !currency) return; // declined spend never touched money

    await this.prisma.transactionRecord.upsert({
      where: { id: transactionId },
      create: {
        id: transactionId,
        tenantId: event.tenantId,
        customerId,
        type: "CARD",
        direction: "DEBIT",
        amount,
        currency,
        status: "COMPLETED",
        occurredAt: new Date(event.occurredAt),
      },
      update: {},
    });
  }

  async statement(user: AuthenticatedUser, customerId: string, limit: number) {
    assertCanAccess(user, customerId);
    return this.prisma.transactionRecord.findMany({
      where: { tenantId: user.tenantId, customerId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  async activity(user: AuthenticatedUser, customerId: string, sinceDays: number) {
    assertCanAccess(user, customerId);
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const records = await this.prisma.transactionRecord.findMany({
      where: { tenantId: user.tenantId, customerId, occurredAt: { gte: since }, status: "COMPLETED" },
    });

    const summary = { totalDebits: 0, totalCredits: 0, byType: {} as Record<string, number> };
    for (const r of records) {
      if (r.direction === "DEBIT") summary.totalDebits += r.amount;
      else summary.totalCredits += r.amount;
      summary.byType[r.type] = (summary.byType[r.type] ?? 0) + 1;
    }
    return { customerId, sinceDays, transactionCount: records.length, ...summary };
  }

  async transfersReport(user: AuthenticatedUser) {
    const rows = await this.prisma.transactionRecord.groupBy({
      by: ["status"],
      where: { tenantId: user.tenantId, type: "TRANSFER", direction: "DEBIT" },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all, totalAmount: r._sum.amount ?? 0 }));
  }

  async failedTransactions(user: AuthenticatedUser, limit: number) {
    return this.prisma.transactionRecord.findMany({
      where: { tenantId: user.tenantId, status: "FAILED" },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }
}
