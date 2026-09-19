import { z } from "zod";
import { extendEnvSchema } from "@digital-banking/config";

const notificationEnvSchema = extendEnvSchema({
  NOTIFICATION_DATABASE_URL: z.string().url(),
  NOTIFICATION_SERVICE_PORT: z.coerce.number().default(3008),
});

export function validateEnv(raw: Record<string, unknown>) {
  const result = notificationEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid notification-service environment: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
