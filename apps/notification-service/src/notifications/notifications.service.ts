import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainEvent } from "@digital-banking/events";
import { STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATION_PROVIDER_ADAPTER, NotificationProviderAdapter } from "../provider/notification-provider.adapter";

interface Template {
  subject: string;
  body: string;
}

function templateFor(eventType: string, data: Record<string, unknown>): Template {
  switch (eventType) {
    case "AccountCreated":
      return {
        subject: "Your new account is ready",
        body: `Your new ${data.type} account (${data.accountId}) has been created.`,
      };
    case "KycApproved":
      return {
        subject: "Identity verification approved",
        body: "Your identity verification was approved. You can now open accounts.",
      };
    case "KycRejected":
      return {
        subject: "Identity verification rejected",
        body: `Your identity verification was rejected: ${data.reason}`,
      };
    case "TransferCompleted":
      return {
        subject: "Transfer completed",
        body: `Your transfer (${data.transferId}) completed successfully.`,
      };
    case "TransferFailed":
      return {
        subject: "Transfer could not be completed",
        body: `Your transfer (${data.transferId}) failed: ${data.reason}`,
      };
    default:
      return { subject: eventType, body: JSON.stringify(data) };
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER_ADAPTER) private readonly provider: NotificationProviderAdapter,
  ) {}

  // Fully asynchronous and never blocks the transaction that triggered it —
  // a failure here is logged and recorded, never propagated back into the
  // financial flow that emitted the event (PRD section 14, section 39).
  async handleEvent(event: DomainEvent<{ customerId?: string; [key: string]: unknown }>): Promise<void> {
    const customerId = event.data.customerId;
    if (!customerId) {
      this.logger.warn(`Event ${event.eventType} has no customerId — nothing to notify`);
      return;
    }

    const { subject, body } = templateFor(event.eventType, event.data);

    let sent = false;
    try {
      const result = await this.provider.send({
        channel: "EMAIL",
        recipientCustomerId: customerId,
        subject,
        body,
      });
      sent = result.sent;
    } catch (err) {
      this.logger.error(`Notification provider failed: ${err instanceof Error ? err.message : err}`);
    }

    await this.prisma.notificationLog.create({
      data: {
        tenantId: event.tenantId,
        customerId,
        channel: "EMAIL",
        eventType: event.eventType,
        subject,
        body,
        status: sent ? "SENT" : "FAILED",
      },
    });
  }

  async list(user: AuthenticatedUser, customerId?: string) {
    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const effectiveCustomerId = isStaff ? customerId : user.userId;

    return this.prisma.notificationLog.findMany({
      where: { tenantId: user.tenantId, ...(effectiveCustomerId ? { customerId: effectiveCustomerId } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }
}
