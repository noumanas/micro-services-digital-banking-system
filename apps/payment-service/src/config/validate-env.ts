import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const paymentEnvSchema = extendEnvSchema({
  PAYMENT_DATABASE_URL: z.string().url(),
  PAYMENT_SERVICE_PORT: z.coerce.number().default(3009),
  LEDGER_SERVICE_URL: z.string().url(),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = paymentEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid payment-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
