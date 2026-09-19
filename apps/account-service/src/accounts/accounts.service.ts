import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma-client";
import { DomainEvent, createDomainEvent } from "@digital-banking/events";
import { ConflictDomainError, ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";

function assertCanAccess(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && user.userId !== customerId) {
    throw new ForbiddenDomainError("Cannot access another customer's accounts");
  }
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateAccountDto, correlationId: string) {
    assertCanAccess(user, dto.customerId);

    const kycStatus = await this.prisma.customerKycStatus.findUnique({
      where: { tenantId_customerId: { tenantId: user.tenantId, customerId: dto.customerId } },
    });
    if (!kycStatus?.approved) {
      throw new ForbiddenDomainError(
        "Customer must complete KYC verification before an account can be created",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          type: dto.type,
          currency: dto.currency,
          status: "PENDING_ACTIVATION",
        },
      });

      await this.emit(tx, "AccountCreated", account.tenantId, account.id, correlationId, {
        accountId: account.id,
        customerId: account.customerId,
        type: account.type,
        currency: account.currency,
      });

      return account;
    });
  }

  async activate(user: AuthenticatedUser, id: string, correlationId: string) {
    const account = await this.getOwned(user, id);
    if (account.status !== "PENDING_ACTIVATION") {
      throw new ConflictDomainError(`Account ${id} is not pending activation`);
    }
    return this.transition(account, "ACTIVE", "AccountActivated", correlationId);
  }

  async freeze(user: AuthenticatedUser, id: string, correlationId: string) {
    const account = await this.getOwned(user, id);
    if (account.status !== "ACTIVE") {
      throw new ConflictDomainError(`Account ${id} is not active`);
    }
    return this.transition(account, "FROZEN", "AccountFrozen", correlationId);
  }

  async unfreeze(user: AuthenticatedUser, id: string, correlationId: string) {
    const account = await this.getOwned(user, id);
    if (account.status !== "FROZEN") {
      throw new ConflictDomainError(`Account ${id} is not frozen`);
    }
    return this.transition(account, "ACTIVE", "AccountUnfrozen", correlationId);
  }

  async close(user: AuthenticatedUser, id: string, correlationId: string) {
    const account = await this.getOwned(user, id);
    if (account.status === "CLOSED") {
      throw new ConflictDomainError(`Account ${id} is already closed`);
    }
    return this.transition(account, "CLOSED", "AccountClosed", correlationId);
  }

  async findById(user: AuthenticatedUser, id: string) {
    return this.getOwned(user, id);
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.account.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  // Platform administration — a SUPER_ADMIN viewing a tenant that isn't
  // their own. Deliberately separate from list() above: that method also
  // widens self-vs-staff scope by customerId, and conflating "any customer
  // in my tenant" with "any tenant at all" in one code path is exactly the
  // kind of ambiguity that causes tenant-isolation bugs.
  async listByTenant(tenantId: string) {
    return this.prisma.account.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  // Consumes kyc-service's KycApproved/KycRejected independently of
  // customer-service (PRD section 17 event catalog).
  async handleKycDecision(event: DomainEvent<{ customerId: string }>, approved: boolean): Promise<void> {
    const { customerId } = event.data;
    await this.prisma.customerKycStatus.upsert({
      where: { tenantId_customerId: { tenantId: event.tenantId, customerId } },
      create: { tenantId: event.tenantId, customerId, approved },
      update: { approved },
    });
  }

  private async getOwned(user: AuthenticatedUser, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!account) {
      throw new NotFoundDomainError("Account", id);
    }
    assertCanAccess(user, account.customerId);
    return account;
  }

  private async transition(
    account: { id: string; tenantId: string },
    status: string,
    eventType: string,
    correlationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({ where: { id: account.id }, data: { status } });
      await this.emit(tx, eventType, account.tenantId, account.id, correlationId, { accountId: account.id });
      return updated;
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
      producer: "account-service",
      aggregateType: "account",
      aggregateId,
      data,
    });

    await tx.outboxEvent.create({
      data: { tenantId, eventType: event.eventType, payload: event as unknown as Prisma.InputJsonValue },
    });
  }
}
