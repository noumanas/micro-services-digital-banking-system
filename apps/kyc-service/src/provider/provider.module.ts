import { Module } from "@nestjs/common";
import { KYC_PROVIDER_ADAPTER } from "./kyc-provider.adapter";
import { MockKycProvider } from "./mock-kyc.provider";

@Module({
  providers: [{ provide: KYC_PROVIDER_ADAPTER, useClass: MockKycProvider }],
  exports: [KYC_PROVIDER_ADAPTER],
})
export class ProviderModule {}
