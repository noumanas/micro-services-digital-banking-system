import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const transferEnvSchema = extendEnvSchema({
  TRANSFER_DATABASE_URL: z.string().url(),
  TRANSFER_SERVICE_PORT: z.coerce.number().default(3007),
  LEDGER_SERVICE_URL: z.string().url(),
  DAILY_TRANSFER_LIMIT: z.coerce.number().default(1_000_000), // $10,000.00 in cents
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = transferEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid transfer-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
