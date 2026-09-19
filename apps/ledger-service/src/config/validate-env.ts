import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const ledgerEnvSchema = extendEnvSchema({
  LEDGER_DATABASE_URL: z.string().url(),
  LEDGER_SERVICE_PORT: z.coerce.number().default(3005),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = ledgerEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid ledger-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
