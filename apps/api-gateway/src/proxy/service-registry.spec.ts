import { buildServiceRoutes } from "./service-registry";

describe("buildServiceRoutes", () => {
  it("routes each service prefix to its own base URL", () => {
    const routes = buildServiceRoutes({
      identityServiceUrl: "http://identity:3001",
      customerServiceUrl: "http://customer:3002",
      kycServiceUrl: "http://kyc:3003",
      accountServiceUrl: "http://account:3004",
      ledgerServiceUrl: "http://ledger:3005",
      fraudServiceUrl: "http://fraud:3006",
      transferServiceUrl: "http://transfer:3007",
      notificationServiceUrl: "http://notification:3008",
      paymentServiceUrl: "http://payment:3009",
      cardServiceUrl: "http://card:3010",
      reportingServiceUrl: "http://reporting:3011",
    });

    const byPrefix = Object.fromEntries(routes.map((r) => [r.pathPrefix, r.target]));

    expect(byPrefix["/v1/auth"]).toBe("http://identity:3001");
    expect(byPrefix["/v1/tenants"]).toBe("http://identity:3001");
    expect(byPrefix["/v1/customers"]).toBe("http://customer:3002");
    expect(byPrefix["/v1/kyc"]).toBe("http://kyc:3003");
    expect(byPrefix["/v1/accounts"]).toBe("http://account:3004");
    expect(byPrefix["/v1/ledger"]).toBe("http://ledger:3005");
    expect(byPrefix["/v1/fraud"]).toBe("http://fraud:3006");
    expect(byPrefix["/v1/transfers"]).toBe("http://transfer:3007");
    expect(byPrefix["/v1/notifications"]).toBe("http://notification:3008");
    expect(byPrefix["/v1/payments"]).toBe("http://payment:3009");
    expect(byPrefix["/v1/cards"]).toBe("http://card:3010");
    expect(byPrefix["/v1/reports"]).toBe("http://reporting:3011");
  });
});
