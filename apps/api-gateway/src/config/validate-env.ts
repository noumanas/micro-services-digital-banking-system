import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const gatewayEnvSchema = extendEnvSchema({
  API_GATEWAY_PORT: z.coerce.number().default(3000),
  IDENTITY_SERVICE_URL: z.string().url(),
  CUSTOMER_SERVICE_URL: z.string().url(),
  KYC_SERVICE_URL: z.string().url(),
  ACCOUNT_SERVICE_URL: z.string().url(),
  LEDGER_SERVICE_URL: z.string().url(),
  FRAUD_SERVICE_URL: z.string().url(),
  TRANSFER_SERVICE_URL: z.string().url(),
  NOTIFICATION_SERVICE_URL: z.string().url(),
  PAYMENT_SERVICE_URL: z.string().url(),
  CARD_SERVICE_URL: z.string().url(),
  REPORTING_SERVICE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default("http://localhost:4200"),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = gatewayEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid api-gateway environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
