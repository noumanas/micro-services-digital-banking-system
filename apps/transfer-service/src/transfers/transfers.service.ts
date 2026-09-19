import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../generated/prisma-client";
import { DomainEvent, createDomainEvent } from "@digital-banking/events";
import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
  STAFF_ROLES,
} from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";

function assertOwnsAccount(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && customerId !== user.userId) {
    throw new ForbiddenDomainError("Cannot transfer from another customer's account");
  }
}

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerClient: LedgerClientService,
    private readonly config: ConfigService,
  ) {}

  // Consumes account-service's AccountCreated to build a local ownership +
  // currency read-model (PRD section 23 — never a live cross-service call).
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

  async create(user: AuthenticatedUser, dto: CreateTransferDto, idempotencyKey: string, correlationId: string) {
    const existing = await this.prisma.transfer.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey } },
    });
    if (existing) return existing; // PRD section 21: same request twice, same result, no duplicate

    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new ConflictDomainError("Source and destination accounts must differ");
    }

    const source = await this.prisma.accountOwnership.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: dto.sourceAccountId } },
    });
    if (!source) {
      throw new NotFoundDomainError("Account", dto.sourceAccountId);
    }
    assertOwnsAccount(user, source.customerId);

    const destination = await this.prisma.accountOwnership.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: dto.destinationAccountId } },
    });
    if (!destination) {
      throw new NotFoundDomainError("Account", dto.destinationAccountId);
    }

    if (source.currency !== dto.currency || destination.currency !== dto.currency) {
      throw new ConflictDomainError(
        `Currency mismatch: source is ${source.currency}, destination is ${destination.currency}, requested ${dto.currency}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.create({
        data: {
          tenantId: user.tenantId,
          customerId: source.customerId,
          idempotencyKey,
          sourceAccountId: dto.sourceAccountId,
          destinationAccountId: dto.destinationAccountId,
          amount: dto.amount,
          currency: dto.currency,
          status: "PENDING",
        },
      });

      await this.emit(tx, "TransferInitiated", user.tenantId, transfer.id, correlationId, {
        transferId: transfer.id,
        customerId: transfer.customerId,
        sourceAccountId: transfer.sourceAccountId,
        destinationAccountId: transfer.destinationAccountId,
        amount: transfer.amount,
        currency: transfer.currency,
      });

      return transfer;
    });
  }

  async cancel(user: AuthenticatedUser, id: string, correlationId: string) {
    const transfer = await this.getOwned(user, id);
    if (transfer.status !== "PENDING") {
      throw new ConflictDomainError(`Transfer ${id} is no longer pending and cannot be cancelled`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transfer.update({ where: { id }, data: { status: "CANCELLED" } });
      await this.emit(tx, "TransferCancelled", user.tenantId, id, correlationId, {
        transferId: id,
        customerId: transfer.customerId,
      });
      return updated;
    });
  }

  // Consumes fraud-service's TransferApproved/Flagged/Blocked — the next
  // step in the saga (PRD section 31).
  async handleFraudDecision(
    event: DomainEvent<{ transferId: string; decision: "APPROVED" | "FLAGGED" | "BLOCKED"; reason: string }>,
  ): Promise<void> {
    const { transferId, decision, reason } = event.data;
    const transfer = await this.prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      this.logger.warn(`Fraud decision for unknown transfer ${transferId}`);
      return;
    }
    if (transfer.status !== "PENDING") {
      return; // idempotent replay, or already cancelled
    }

    if (decision === "BLOCKED" || decision === "FLAGGED") {
      await this.prisma.$transaction(async (tx) => {
        await tx.transfer.update({
          where: { id: transferId },
          data: { status: decision === "BLOCKED" ? "FAILED" : "FLAGGED", failureReason: reason },
        });
        await this.emit(tx, "TransferFailed", transfer.tenantId, transferId, event.correlationId, {
          transferId,
          customerId: transfer.customerId,
          reason,
        });
      });
      return;
    }

    await this.checkLimitAndPost(transfer, event.correlationId);
  }

  private async checkLimitAndPost(
    transfer: { id: string; tenantId: string; customerId: string; sourceAccountId: string; destinationAccountId: string; amount: number; currency: string },
    correlationId: string,
  ): Promise<void> {
    const dailyLimit = this.config.get<number>("DAILY_TRANSFER_LIMIT", 1_000_000);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.transfer.aggregate({
      where: { tenantId: transfer.tenantId, customerId: transfer.customerId, status: "COMPLETED", createdAt: { gte: since } },
      _sum: { amount: true },
    });
    const spentToday = recent._sum.amount ?? 0;

    if (spentToday + transfer.amount > dailyLimit) {
      await this.prisma.$transaction(async (tx) => {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: { status: "FAILED", failureReason: "Daily transfer limit exceeded" },
        });
        await this.emit(tx, "TransferFailed", transfer.tenantId, transfer.id, correlationId, {
          transferId: transfer.id,
          customerId: transfer.customerId,
          reason: "Daily transfer limit exceeded",
        });
      });
      return;
    }

    try {
      const entry = await this.ledgerClient.postTransfer({
        tenantId: transfer.tenantId,
        sourceAccountId: transfer.sourceAccountId,
        destinationAccountId: transfer.destinationAccountId,
        amount: transfer.amount,
        currency: transfer.currency,
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: { status: "COMPLETED", journalEntryId: entry.id, completedAt: new Date() },
        });
        await this.emit(tx, "TransferCompleted", transfer.tenantId, transfer.id, correlationId, {
          transferId: transfer.id,
          customerId: transfer.customerId,
          journalEntryId: entry.id,
        });
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Ledger posting failed";
      await this.prisma.$transaction(async (tx) => {
        await tx.transfer.update({ where: { id: transfer.id }, data: { status: "FAILED", failureReason: reason } });
        await this.emit(tx, "TransferFailed", transfer.tenantId, transfer.id, correlationId, {
          transferId: transfer.id,
          customerId: transfer.customerId,
          reason,
        });
      });
    }
  }

  async findById(user: AuthenticatedUser, id: string) {
    return this.getOwned(user, id);
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.transfer.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOwned(user: AuthenticatedUser, id: string) {
    const transfer = await this.prisma.transfer.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!transfer) {
      throw new NotFoundDomainError("Transfer", id);
    }
    assertOwnsAccount(user, transfer.customerId);
    return transfer;
  }

  private async emit(
    tx: Prisma.TransactionClient,
    eventType: string,
    tenantId: string,
    aggregateId: string,
    correlationId: string,
    data: Record<string, unknown>,
  ) {
    const event = createDomainEvent({
      eventType,
      tenantId,
      correlationId,
      producer: "transfer-service",
      aggregateType: "transfer",
      aggregateId,
      data,
    });

    await tx.outboxEvent.create({
      data: { tenantId, eventType: event.eventType, payload: event as unknown as Prisma.InputJsonValue },
    });
  }
}
