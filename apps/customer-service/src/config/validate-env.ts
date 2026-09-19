import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const customerEnvSchema = extendEnvSchema({
  CUSTOMER_DATABASE_URL: z.string().url(),
  CUSTOMER_SERVICE_PORT: z.coerce.number().default(3002),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = customerEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid customer-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
