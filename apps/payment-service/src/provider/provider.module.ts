import { Module } from "@nestjs/common";
import { PAYMENT_PROVIDER_ADAPTER } from "./payment-provider.adapter";
import { MockPaymentProvider } from "./mock-payment.provider";

@Module({
  providers: [{ provide: PAYMENT_PROVIDER_ADAPTER, useClass: MockPaymentProvider }],
  exports: [PAYMENT_PROVIDER_ADAPTER],
})
export class ProviderModule {}
