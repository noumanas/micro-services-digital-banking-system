import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const identityEnvSchema = extendEnvSchema({
  IDENTITY_DATABASE_URL: z.string().url(),
  IDENTITY_SERVICE_PORT: z.coerce.number().default(3001),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = identityEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid identity-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
