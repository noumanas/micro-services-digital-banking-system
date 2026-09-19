import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("reporting-service");

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
    .setTitle("Reporting Service API")
    .setDescription(
      "Read-only reports built entirely from a denormalized event-sourced read-model — never a live " +
        "query against another service's transactional database. Covers statements, activity summaries, " +
        "transfer breakdowns, and failed transactions. Fees, settlement, and reconciliation reports are " +
        "future work. See PRD section 43.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.REPORTING_SERVICE_PORT ?? 3011;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`reporting-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`reporting-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
