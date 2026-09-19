import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma-client";
import { createDomainEvent } from "@digital-banking/events";
import { ConflictDomainError, ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";
import { PAYMENT_PROVIDER_ADAPTER, PaymentProviderAdapter } from "../provider/payment-provider.adapter";
import { CreatePaymentDto } from "./dto/create-payment.dto";

function assertOwnsAccount(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && customerId !== user.userId) {
    throw new ForbiddenDomainError("Cannot initiate a payment on another customer's account");
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerClient: LedgerClientService,
    @Inject(PAYMENT_PROVIDER_ADAPTER) private readonly provider: PaymentProviderAdapter,
  ) {}

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

  async create(user: AuthenticatedUser, dto: CreatePaymentDto, idempotencyKey: string, correlationId: string) {
    const existing = await this.prisma.payment.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: user.tenantId, idempotencyKey } },
    });
    if (existing) return existing; // PRD section 21

    const account = await this.prisma.accountOwnership.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: dto.accountId } },
    });
    if (!account) {
      throw new NotFoundDomainError("Account", dto.accountId);
    }
    assertOwnsAccount(user, account.customerId);

    if (account.currency !== dto.currency) {
      throw new ConflictDomainError(
        `Account ${dto.accountId} is denominated in ${account.currency}, not ${dto.currency}`,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId: user.tenantId,
          customerId: account.customerId,
          accountId: dto.accountId,
          direction: dto.direction,
          amount: dto.amount,
          currency: dto.currency,
          externalReference: dto.externalReference,
          idempotencyKey,
          status: "PENDING",
        },
      });

      await this.emit(tx, "PaymentInitiated", user.tenantId, created.id, correlationId, {
        paymentId: created.id,
        customerId: created.customerId,
        accountId: created.accountId,
        direction: created.direction,
        amount: created.amount,
        currency: created.currency,
      });

      return created;
    });

    return this.authorizeAndSettle(payment, dto.simulate, correlationId);
  }

  private async authorizeAndSettle(
    payment: {
      id: string;
      tenantId: string;
      customerId: string;
      accountId: string;
      direction: string;
      amount: number;
      currency: string;
      externalReference: string | null;
    },
    simulate: "approve" | "decline" | undefined,
    correlationId: string,
  ) {
    const decision = await this.provider.authorize({
      direction: payment.direction as "INBOUND" | "OUTBOUND",
      amount: payment.amount,
      currency: payment.currency,
      simulate,
    });

    if (!decision.approved) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: decision.reason },
        });
        await this.emit(tx, "PaymentFailed", payment.tenantId, payment.id, correlationId, {
          paymentId: payment.id,
          customerId: payment.customerId,
          reason: decision.reason,
        });
        return updated;
      });
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "AUTHORIZED" } });
    await this.prisma.$transaction(async (tx) => {
      await this.emit(tx, "PaymentAuthorized", payment.tenantId, payment.id, correlationId, {
        paymentId: payment.id,
        customerId: payment.customerId,
      });
    });

    try {
      const movement =
        payment.direction === "INBOUND"
          ? await this.ledgerClient.postDeposit({
              tenantId: payment.tenantId,
              accountId: payment.accountId,
              amount: payment.amount,
              currency: payment.currency,
              description: payment.externalReference ?? undefined,
            })
          : await this.ledgerClient.postWithdrawal({
              tenantId: payment.tenantId,
              accountId: payment.accountId,
              amount: payment.amount,
              currency: payment.currency,
              description: payment.externalReference ?? undefined,
            });

      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "COMPLETED", journalEntryId: movement.id, completedAt: new Date() },
        });
        await this.emit(tx, "PaymentCompleted", payment.tenantId, payment.id, correlationId, {
          paymentId: payment.id,
          customerId: payment.customerId,
          journalEntryId: movement.id,
        });
        return updated;
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Ledger posting failed";
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: reason },
        });
        await this.emit(tx, "PaymentFailed", payment.tenantId, payment.id, correlationId, {
          paymentId: payment.id,
          customerId: payment.customerId,
          reason,
        });
        return updated;
      });
    }
  }

  async reverse(user: AuthenticatedUser, id: string, correlationId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!payment) {
      throw new NotFoundDomainError("Payment", id);
    }
    if (payment.status !== "COMPLETED" || !payment.journalEntryId) {
      throw new ConflictDomainError(`Payment ${id} is not in a reversible state`);
    }

    await this.ledgerClient.postReversal(user.tenantId, payment.journalEntryId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({ where: { id }, data: { status: "REVERSED" } });
      await this.emit(tx, "PaymentReversed", user.tenantId, id, correlationId, {
        paymentId: id,
        customerId: payment.customerId,
      });
      return updated;
    });
  }

  async findById(user: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!payment) {
      throw new NotFoundDomainError("Payment", id);
    }
    assertOwnsAccount(user, payment.customerId);
    return payment;
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.payment.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
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
      producer: "payment-service",
      aggregateType: "payment",
      aggregateId,
      data,
    });

    await tx.outboxEvent.create({
      data: { tenantId, eventType: event.eventType, payload: event as unknown as Prisma.InputJsonValue },
    });
  }
}
