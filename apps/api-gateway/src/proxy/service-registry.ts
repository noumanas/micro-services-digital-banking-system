export interface ServiceRoute {
  pathPrefix: string;
  target: string;
}

export interface ServiceRegistryConfig {
  identityServiceUrl: string;
  customerServiceUrl: string;
  kycServiceUrl: string;
  accountServiceUrl: string;
  ledgerServiceUrl: string;
  fraudServiceUrl: string;
  transferServiceUrl: string;
  notificationServiceUrl: string;
  paymentServiceUrl: string;
  cardServiceUrl: string;
  reportingServiceUrl: string;
}

// One entry per downstream microservice route. Proxied requests are handled
// entirely by the middleware below and never reach Nest's router/guards —
// authentication for these routes is enforced by each downstream service's
// own GlobalAuthGuard, not by the gateway (the gateway only routes, rate
// limits, and attaches correlation IDs).
//
// Each service's own Swagger UI (/docs) is intentionally NOT proxied here:
// swagger-ui-express emits asset links relative to its own mount path, which
// break once nested under a different gateway prefix. Hit each service's
// /docs directly (see README) instead.
export function buildServiceRoutes(config: ServiceRegistryConfig): ServiceRoute[] {
  return [
    { pathPrefix: "/v1/auth", target: config.identityServiceUrl },
    { pathPrefix: "/v1/tenants", target: config.identityServiceUrl },
    { pathPrefix: "/v1/customers", target: config.customerServiceUrl },
    { pathPrefix: "/v1/kyc", target: config.kycServiceUrl },
    { pathPrefix: "/v1/accounts", target: config.accountServiceUrl },
    { pathPrefix: "/v1/ledger", target: config.ledgerServiceUrl },
    { pathPrefix: "/v1/fraud", target: config.fraudServiceUrl },
    { pathPrefix: "/v1/transfers", target: config.transferServiceUrl },
    { pathPrefix: "/v1/notifications", target: config.notificationServiceUrl },
    { pathPrefix: "/v1/payments", target: config.paymentServiceUrl },
    { pathPrefix: "/v1/cards", target: config.cardServiceUrl },
    { pathPrefix: "/v1/reports", target: config.reportingServiceUrl },
  ];
}
