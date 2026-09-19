import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../generated/prisma-client";
import { createDomainEvent } from "@digital-banking/events";
import { ConflictDomainError, ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerClientService } from "../ledger-client/ledger-client.service";
import { IssueCardDto } from "./dto/issue-card.dto";
import { CardTransactionDto } from "./dto/card-transaction.dto";

function assertOwnsCard(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && customerId !== user.userId) {
    throw new ForbiddenDomainError("Cannot access another customer's card");
  }
}

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerClient: LedgerClientService,
    private readonly config: ConfigService,
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

  async issue(user: AuthenticatedUser, dto: IssueCardDto, correlationId: string) {
    const account = await this.prisma.accountOwnership.findUnique({
      where: { tenantId_accountId: { tenantId: user.tenantId, accountId: dto.accountId } },
    });
    if (!account) {
      throw new NotFoundDomainError("Account", dto.accountId);
    }
    assertOwnsCard(user, account.customerId);

    const defaultLimit = this.config.get<number>("CARD_DEFAULT_DAILY_LIMIT", 500_000);
    const last4 = String(randomInt(0, 10_000)).padStart(4, "0");

    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          tenantId: user.tenantId,
          customerId: account.customerId,
          accountId: dto.accountId,
          type: dto.type,
          last4,
          dailyLimit: dto.dailyLimit ?? defaultLimit,
          status: "PENDING",
        },
      });

      await this.emit(tx, "CardIssued", user.tenantId, card.id, correlationId, {
        cardId: card.id,
        customerId: card.customerId,
        accountId: card.accountId,
      });

      return card;
    });
  }

  async activate(user: AuthenticatedUser, id: string, correlationId: string) {
    const card = await this.getOwned(user, id);
    if (card.status !== "PENDING") {
      throw new ConflictDomainError(`Card ${id} is not pending activation`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date() } });
      await this.emit(tx, "CardActivated", user.tenantId, id, correlationId, { cardId: id });
      return updated;
    });
  }

  async block(user: AuthenticatedUser, id: string, correlationId: string) {
    const card = await this.getOwned(user, id);
    if (card.status === "BLOCKED" || card.status === "CLOSED") {
      throw new ConflictDomainError(`Card ${id} is already ${card.status.toLowerCase()}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({ where: { id }, data: { status: "BLOCKED", blockedAt: new Date() } });
      await this.emit(tx, "CardBlocked", user.tenantId, id, correlationId, {
        cardId: id,
        customerId: card.customerId,
      });
      return updated;
    });
  }

  // The card-network webhook path (PRD section 13: "CardTransactionReceived").
  // A real integration verifies a provider signature here instead of trusting
  // the caller outright — see card.controller.ts.
  async receiveTransaction(cardId: string, dto: CardTransactionDto, correlationId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      throw new NotFoundDomainError("Card", cardId);
    }

    if (card.status !== "ACTIVE") {
      return this.declineTransaction(card, dto, correlationId, `Card is ${card.status.toLowerCase()}, not active`);
    }

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const spentToday = await this.prisma.cardTransaction.aggregate({
      where: { cardId, status: "APPROVED", createdAt: { gte: since } },
      _sum: { amount: true },
    });
    if ((spentToday._sum.amount ?? 0) + dto.amount > card.dailyLimit) {
      return this.declineTransaction(card, dto, correlationId, "Daily card limit exceeded");
    }

    try {
      const movement = await this.ledgerClient.postWithdrawal({
        tenantId: card.tenantId,
        accountId: card.accountId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.merchantName,
      });

      return this.prisma.$transaction(async (tx) => {
        const transaction = await tx.cardTransaction.create({
          data: {
            tenantId: card.tenantId,
            cardId: card.id,
            accountId: card.accountId,
            amount: dto.amount,
            currency: dto.currency,
            merchantName: dto.merchantName,
            status: "APPROVED",
            journalEntryId: movement.id,
          },
        });

        await this.emit(tx, "CardTransactionReceived", card.tenantId, card.id, correlationId, {
          cardId: card.id,
          customerId: card.customerId,
          transactionId: transaction.id,
          status: "APPROVED",
          amount: dto.amount,
          currency: dto.currency,
        });

        return transaction;
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Ledger posting failed";
      return this.declineTransaction(card, dto, correlationId, reason);
    }
  }

  private async declineTransaction(
    card: { id: string; tenantId: string; customerId: string; accountId: string },
    dto: CardTransactionDto,
    correlationId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.cardTransaction.create({
        data: {
          tenantId: card.tenantId,
          cardId: card.id,
          accountId: card.accountId,
          amount: dto.amount,
          currency: dto.currency,
          merchantName: dto.merchantName,
          status: "DECLINED",
          declineReason: reason,
        },
      });

      await this.emit(tx, "CardTransactionReceived", card.tenantId, card.id, correlationId, {
        cardId: card.id,
        customerId: card.customerId,
        transactionId: transaction.id,
        status: "DECLINED",
        reason,
      });

      return transaction;
    });
  }

  async findById(user: AuthenticatedUser, id: string) {
    return this.getOwned(user, id);
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.card.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  // Platform administration — see accounts-service's listByTenant for why
  // this is kept separate from list() above rather than overloaded onto it.
  async listByTenant(tenantId: string) {
    return this.prisma.card.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  private async getOwned(user: AuthenticatedUser, id: string) {
    const card = await this.prisma.card.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!card) {
      throw new NotFoundDomainError("Card", id);
    }
    assertOwnsCard(user, card.customerId);
    return card;
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
      producer: "card-service",
      aggregateType: "card",
      aggregateId,
      data,
    });

    await tx.outboxEvent.create({
      data: { tenantId, eventType: event.eventType, payload: event as unknown as Prisma.InputJsonValue },
    });
  }
}
