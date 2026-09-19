import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("api-gateway");

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Body parsing is disabled: proxied requests must stream through to the
  // downstream service untouched, not be consumed and re-encoded here.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // The customer-portal (and any other browser client) calls this gateway
  // directly from a different origin — the downstream services never see
  // browser requests, so CORS only needs to be handled here.
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:4200")
    .split(",")
    .map((origin) => origin.trim());
  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });

  const port = process.env.API_GATEWAY_PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on port ${port}`);
}

bootstrap();
