import { Module } from "@nestjs/common";
import { NOTIFICATION_PROVIDER_ADAPTER } from "./notification-provider.adapter";
import { MockNotificationProvider } from "./mock-notification.provider";

@Module({
  providers: [{ provide: NOTIFICATION_PROVIDER_ADAPTER, useClass: MockNotificationProvider }],
  exports: [NOTIFICATION_PROVIDER_ADAPTER],
})
export class ProviderModule {}
