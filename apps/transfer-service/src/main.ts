import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("transfer-service");

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
    .setTitle("Transfer Service API")
    .setDescription(
      "Internal transfers, orchestrated as a saga: TransferInitiated -> fraud check -> limit check -> " +
        "ledger posting -> TransferCompleted/Failed. See PRD section 12, section 29, section 31.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.TRANSFER_SERVICE_PORT ?? 3007;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`transfer-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`transfer-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
