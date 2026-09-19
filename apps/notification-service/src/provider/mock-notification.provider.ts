import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationProviderAdapter,
  SendNotificationInput,
  SendNotificationResult,
} from "./notification-provider.adapter";

// Local dev / demo stand-in for a real email/SMS/push vendor — logs instead
// of sending. A real implementation (SendGrid, Twilio, FCM, ...) plugs in
// behind the same NotificationProviderAdapter interface without touching
// NotificationsService.
@Injectable()
export class MockNotificationProvider implements NotificationProviderAdapter {
  private readonly logger = new Logger(MockNotificationProvider.name);

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    this.logger.log(`[mock ${input.channel}] to customer ${input.recipientCustomerId}: ${input.subject}`);
    return { sent: true };
  }
}
