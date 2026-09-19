import { Injectable } from "@nestjs/common";
import { DomainEvent, createDomainEvent } from "@digital-banking/events";
import { ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { Prisma } from "../../generated/prisma-client";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

function assertCanAccess(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && user.userId !== customerId) {
    throw new ForbiddenDomainError("Cannot access another customer's profile");
  }
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(user: AuthenticatedUser, id: string) {
    assertCanAccess(user, id);
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!customer) {
      throw new NotFoundDomainError("Customer", id);
    }
    return customer;
  }

  async list(tenantId: string) {
    return this.prisma.customer.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async findDisplayName(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!customer) {
      throw new NotFoundDomainError("Customer", id);
    }

    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
    return { id: customer.id, name: fullName || customer.email };
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCustomerDto, correlationId: string) {
    await this.findById(user, id);

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: { firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone },
      });

      const event = createDomainEvent({
        eventType: "CustomerUpdated",
        tenantId: user.tenantId,
        correlationId,
        producer: "customer-service",
        aggregateType: "customer",
        aggregateId: id,
        data: { customerId: id },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: user.tenantId,
          eventType: event.eventType,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      return customer;
    });
  }

  // Consumes identity-service's UserRegistered — the customer profile is
  // created asynchronously rather than via a direct API call, so the two
  // services stay decoupled (PRD section 45, principle 3).
  async handleUserRegistered(event: DomainEvent<{ userId: string; email: string }>): Promise<void> {
    const { userId, email } = event.data;

    const existing = await this.prisma.customer.findUnique({ where: { id: userId } });
    if (existing) {
      return; // already processed — consumers must be idempotent (PRD section 19)
    }

    await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { id: userId, tenantId: event.tenantId, email, status: "ACTIVE", kycStatus: "PENDING" },
      });

      const outboxEvent = createDomainEvent({
        eventType: "CustomerCreated",
        tenantId: customer.tenantId,
        correlationId: event.correlationId,
        causationId: event.eventId,
        producer: "customer-service",
        aggregateType: "customer",
        aggregateId: customer.id,
        data: { customerId: customer.id, email: customer.email },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: customer.tenantId,
          eventType: outboxEvent.eventType,
          payload: outboxEvent as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  // Consumes kyc-service's KycApproved/KycRejected (PRD section 17 event
  // catalog: consumed by both Customer and Account services independently).
  async handleKycDecision(
    event: DomainEvent<{ customerId: string }>,
    approved: boolean,
  ): Promise<void> {
    const { customerId } = event.data;
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundDomainError("Customer", customerId);
    }

    const newStatus = approved ? "APPROVED" : "REJECTED";
    if (customer.kycStatus === newStatus) {
      return; // idempotent replay
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data: { kycStatus: newStatus } });

      const outboxEvent = createDomainEvent({
        eventType: approved ? "CustomerKycApproved" : "CustomerKycRejected",
        tenantId: customer.tenantId,
        correlationId: event.correlationId,
        causationId: event.eventId,
        producer: "customer-service",
        aggregateType: "customer",
        aggregateId: customerId,
        data: { customerId },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: customer.tenantId,
          eventType: outboxEvent.eventType,
          payload: outboxEvent as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }
}
