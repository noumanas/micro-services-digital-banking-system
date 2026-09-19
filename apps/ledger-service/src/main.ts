import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("ledger-service");

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Ledger Service API")
    .setDescription(
      "The financial source of truth: double-entry journal, balances, transaction history, and " +
        "reversals. See PRD section 10 and section 24.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.LEDGER_SERVICE_PORT ?? 3005;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ledger-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`ledger-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
