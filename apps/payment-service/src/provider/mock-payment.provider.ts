import { Injectable } from "@nestjs/common";
import {
  AuthorizePaymentInput,
  AuthorizePaymentResult,
  PaymentProviderAdapter,
} from "./payment-provider.adapter";

// Local dev / demo stand-in for a real processor. Resolves instantly, no
// external call — swap for a real vendor without touching PaymentsService.
@Injectable()
export class MockPaymentProvider implements PaymentProviderAdapter {
  async authorize(input: AuthorizePaymentInput): Promise<AuthorizePaymentResult> {
    const approved = input.simulate !== "decline";
    return {
      approved,
      reason: approved
        ? "Mock provider auto-approved for local development"
        : "Mock provider simulated a decline",
    };
  }
}
