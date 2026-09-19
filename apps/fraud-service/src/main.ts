import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("fraud-service");

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
    .setTitle("Fraud Service API")
    .setDescription(
      "Transaction risk scoring: amount thresholds + velocity checks. Consumes TransferInitiated, " +
        "produces TransferApproved/Flagged/Blocked. See PRD section 15.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.FRAUD_SERVICE_PORT ?? 3006;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`fraud-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`fraud-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
