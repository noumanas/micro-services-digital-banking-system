import { Injectable } from "@nestjs/common";
import {
  KycProviderAdapter,
  KycVerificationInput,
  KycVerificationResult,
} from "./kyc-provider.adapter";

// Local dev / demo stand-in for a real verification vendor. Resolves
// instantly (no document upload, no external call) so the whole
// register -> submit KYC -> approved flow can be exercised end to end
// without any third-party dependency.
@Injectable()
export class MockKycProvider implements KycProviderAdapter {
  async verify(input: KycVerificationInput): Promise<KycVerificationResult> {
    const approved = input.simulate !== "reject";
    return {
      approved,
      reason: approved
        ? "Mock provider auto-approved for local development"
        : "Mock provider simulated a rejection",
    };
  }
}
