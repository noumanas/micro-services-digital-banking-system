// A real email/SMS/push vendor sits behind this interface, never called
// directly from event handlers (same pattern as kyc-service's provider
// adapter — PRD section 8's principle applied to PRD section 14).
export interface SendNotificationInput {
  channel: "EMAIL" | "SMS" | "PUSH" | "IN_APP";
  recipientCustomerId: string;
  subject: string;
  body: string;
}

export interface SendNotificationResult {
  sent: boolean;
}

export interface NotificationProviderAdapter {
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}

export const NOTIFICATION_PROVIDER_ADAPTER = Symbol("NOTIFICATION_PROVIDER_ADAPTER");
