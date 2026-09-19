import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const reportingEnvSchema = extendEnvSchema({
  REPORTING_DATABASE_URL: z.string().url(),
  REPORTING_SERVICE_PORT: z.coerce.number().default(3011),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = reportingEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid reporting-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
