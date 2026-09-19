import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const kycEnvSchema = extendEnvSchema({
  KYC_DATABASE_URL: z.string().url(),
  KYC_SERVICE_PORT: z.coerce.number().default(3003),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = kycEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid kyc-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
