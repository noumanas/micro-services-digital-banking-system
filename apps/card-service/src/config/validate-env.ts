import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const cardEnvSchema = extendEnvSchema({
  CARD_DATABASE_URL: z.string().url(),
  CARD_SERVICE_PORT: z.coerce.number().default(3010),
  LEDGER_SERVICE_URL: z.string().url(),
  CARD_DEFAULT_DAILY_LIMIT: z.coerce.number().default(500_000), // $5,000.00 in cents
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = cardEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid card-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
