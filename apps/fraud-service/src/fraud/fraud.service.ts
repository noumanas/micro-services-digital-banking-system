import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../generated/prisma-client";
import { DomainEvent, createDomainEvent } from "@digital-banking/events";
import { NotFoundDomainError } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";

type Decision = "APPROVED" | "FLAGGED" | "BLOCKED";

interface TransferInitiatedData {
  transferId: string;
  sourceAccountId: string;
  amount: number;
  currency: string;
}

@Injectable()
export class FraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Consumes transfer-service's TransferInitiated. A simple, explainable
  // rule engine (amount threshold + velocity), not ML — matches PRD section
  // 15's responsibilities without a real risk model, which is out of scope
  // for this platform. Naming follows PRD section 17's event catalog
  // (TransferApproved, produced by Fraud, consumed by Transfer) rather than
  // section 15's generic Transaction* names, since transfer is the only
  // transaction type wired up so far.
  async evaluateTransfer(event: DomainEvent<TransferInitiatedData>): Promise<void> {
    const { transferId, sourceAccountId, amount, currency } = event.data;

    const existing = await this.prisma.fraudCheck.findUnique({ where: { transferId } });
    if (existing) return; // idempotent replay — PRD section 19

    const blockThreshold = this.config.get<number>("FRAUD_BLOCK_THRESHOLD", 5_000_000);
    const flagThreshold = this.config.get<number>("FRAUD_FLAG_THRESHOLD", 1_000_000);
    const windowMinutes = this.config.get<number>("FRAUD_VELOCITY_WINDOW_MINUTES", 10);
    const maxCount = this.config.get<number>("FRAUD_VELOCITY_MAX_COUNT", 5);

    let decision: Decision;
    let reason: string;

    if (amount > blockThreshold) {
      decision = "BLOCKED";
      reason = `Amount ${amount} exceeds the block threshold of ${blockThreshold}`;
    } else if (amount > flagThreshold) {
      decision = "FLAGGED";
      reason = `Amount ${amount} exceeds the flag threshold of ${flagThreshold}`;
    } else {
      const since = new Date(Date.now() - windowMinutes * 60_000);
      const recentCount = await this.prisma.fraudCheck.count({
        where: { tenantId: event.tenantId, sourceAccountId, createdAt: { gte: since } },
      });
      if (recentCount >= maxCount) {
        decision = "FLAGGED";
        reason = `${recentCount + 1} transfers from this account within ${windowMinutes} minutes`;
      } else {
        decision = "APPROVED";
        reason = "Within normal amount and velocity limits";
      }
    }

    const eventType = decision === "APPROVED" ? "TransferApproved" : decision === "FLAGGED" ? "TransferFlagged" : "TransferBlocked";

    await this.prisma.$transaction(async (tx) => {
      await tx.fraudCheck.create({
        data: { tenantId: event.tenantId, transferId, sourceAccountId, amount, currency, decision, reason },
      });

      const outboxEvent = createDomainEvent({
        eventType,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        causationId: event.eventId,
        producer: "fraud-service",
        aggregateType: "transfer",
        aggregateId: transferId,
        data: { transferId, decision, reason },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: event.tenantId,
          eventType: outboxEvent.eventType,
          payload: outboxEvent as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async findByTransferId(user: AuthenticatedUser, transferId: string) {
    const check = await this.prisma.fraudCheck.findFirst({ where: { transferId, tenantId: user.tenantId } });
    if (!check) {
      throw new NotFoundDomainError("FraudCheck", transferId);
    }
    return check;
  }

  async list(user: AuthenticatedUser, flaggedOnly: boolean) {
    return this.prisma.fraudCheck.findMany({
      where: {
        tenantId: user.tenantId,
        ...(flaggedOnly ? { decision: { in: ["FLAGGED", "BLOCKED"] } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
