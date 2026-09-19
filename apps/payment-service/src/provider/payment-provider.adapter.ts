// A real payment processor (card network, ACH operator, wire rail) sits
// behind this interface, never called directly from business logic (same
// pattern as kyc-service's provider adapter — PRD section 11).
export interface AuthorizePaymentInput {
  direction: "INBOUND" | "OUTBOUND";
  amount: number;
  currency: string;
  simulate?: "approve" | "decline";
}

export interface AuthorizePaymentResult {
  approved: boolean;
  reason: string;
}

export interface PaymentProviderAdapter {
  authorize(input: AuthorizePaymentInput): Promise<AuthorizePaymentResult>;
}

export const PAYMENT_PROVIDER_ADAPTER = Symbol("PAYMENT_PROVIDER_ADAPTER");
