import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const accountEnvSchema = extendEnvSchema({
  ACCOUNT_DATABASE_URL: z.string().url(),
  ACCOUNT_SERVICE_PORT: z.coerce.number().default(3004),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = accountEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid account-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
