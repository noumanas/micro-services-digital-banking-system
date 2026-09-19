// External identity-verification providers must sit behind an adapter like
// this one, never called directly from business logic (PRD section 8).
// Swap MockKycProvider for a real vendor integration without touching
// KycService.
export interface KycVerificationInput {
  tenantId: string;
  customerId: string;
  simulate?: "approve" | "reject";
}

export interface KycVerificationResult {
  approved: boolean;
  reason: string;
}

export interface KycProviderAdapter {
  verify(input: KycVerificationInput): Promise<KycVerificationResult>;
}

export const KYC_PROVIDER_ADAPTER = Symbol("KYC_PROVIDER_ADAPTER");
