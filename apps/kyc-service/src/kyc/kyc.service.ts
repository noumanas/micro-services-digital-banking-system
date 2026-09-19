import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma-client";
import { createDomainEvent } from "@digital-banking/events";
import { ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { KYC_PROVIDER_ADAPTER, KycProviderAdapter } from "../provider/kyc-provider.adapter";
import { CreateVerificationDto } from "./dto/create-verification.dto";

function assertCanAccess(user: AuthenticatedUser, customerId: string): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && user.userId !== customerId) {
    throw new ForbiddenDomainError("Cannot access another customer's KYC records");
  }
}

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KYC_PROVIDER_ADAPTER) private readonly provider: KycProviderAdapter,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateVerificationDto, correlationId: string) {
    assertCanAccess(user, dto.customerId);

    const verification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.kycVerification.create({
        data: { tenantId: user.tenantId, customerId: dto.customerId, status: "PENDING" },
      });

      const requestedEvent = createDomainEvent({
        eventType: "KycVerificationRequested",
        tenantId: user.tenantId,
        correlationId,
        producer: "kyc-service",
        aggregateType: "kyc-verification",
        aggregateId: created.id,
        data: { verificationId: created.id, customerId: created.customerId },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: user.tenantId,
          eventType: requestedEvent.eventType,
          payload: requestedEvent as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    // The provider call is treated as an external side effect, deliberately
    // outside the creation transaction above — a slow/failing provider must
    // not hold open a DB transaction.
    const result = await this.provider.verify({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      simulate: dto.simulate,
    });

    return this.decide(verification.id, result.approved, result.reason, correlationId);
  }

  private async decide(id: string, approved: boolean, reason: string, correlationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.kycVerification.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          decisionReason: reason,
          decidedAt: new Date(),
        },
      });

      const decisionEvent = createDomainEvent({
        eventType: approved ? "KycApproved" : "KycRejected",
        tenantId: updated.tenantId,
        correlationId,
        producer: "kyc-service",
        aggregateType: "kyc-verification",
        aggregateId: updated.id,
        data: { verificationId: updated.id, customerId: updated.customerId, reason },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: updated.tenantId,
          eventType: decisionEvent.eventType,
          payload: decisionEvent as unknown as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async findById(user: AuthenticatedUser, id: string) {
    const verification = await this.prisma.kycVerification.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!verification) {
      throw new NotFoundDomainError("KycVerification", id);
    }
    assertCanAccess(user, verification.customerId);
    return verification;
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.kycVerification.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }
}
