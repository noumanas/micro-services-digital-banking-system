import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const fraudEnvSchema = extendEnvSchema({
  FRAUD_DATABASE_URL: z.string().url(),
  FRAUD_SERVICE_PORT: z.coerce.number().default(3006),
  FRAUD_BLOCK_THRESHOLD: z.coerce.number().default(5_000_000), // $50,000.00 in cents
  FRAUD_FLAG_THRESHOLD: z.coerce.number().default(1_000_000), // $10,000.00 in cents
  FRAUD_VELOCITY_WINDOW_MINUTES: z.coerce.number().default(10),
  FRAUD_VELOCITY_MAX_COUNT: z.coerce.number().default(5),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = fraudEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid fraud-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
