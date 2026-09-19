import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildServiceRoutes } from "./service-registry";

@Module({})
export class ProxyModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    const routes = buildServiceRoutes({
      identityServiceUrl: this.config.get<string>("IDENTITY_SERVICE_URL")!,
      customerServiceUrl: this.config.get<string>("CUSTOMER_SERVICE_URL")!,
      kycServiceUrl: this.config.get<string>("KYC_SERVICE_URL")!,
      accountServiceUrl: this.config.get<string>("ACCOUNT_SERVICE_URL")!,
      ledgerServiceUrl: this.config.get<string>("LEDGER_SERVICE_URL")!,
      fraudServiceUrl: this.config.get<string>("FRAUD_SERVICE_URL")!,
      transferServiceUrl: this.config.get<string>("TRANSFER_SERVICE_URL")!,
      notificationServiceUrl: this.config.get<string>("NOTIFICATION_SERVICE_URL")!,
      paymentServiceUrl: this.config.get<string>("PAYMENT_SERVICE_URL")!,
      cardServiceUrl: this.config.get<string>("CARD_SERVICE_URL")!,
      reportingServiceUrl: this.config.get<string>("REPORTING_SERVICE_URL")!,
    });

    for (const route of routes) {
      consumer
        .apply(
          createProxyMiddleware({
            target: route.target,
            changeOrigin: true,
            // Nest mounts this middleware the same way Express mounts a
            // sub-app: req.url arrives already stripped of pathPrefix (e.g.
            // "/v1/tenants" becomes "/"). Restore the full path so the
            // downstream service sees the original route.
            pathRewrite: (path) => route.pathPrefix + (path === "/" ? "" : path),
          }),
        )
        .forRoutes(route.pathPrefix);
    }
  }
}
