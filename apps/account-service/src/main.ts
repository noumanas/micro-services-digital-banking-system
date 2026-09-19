import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("account-service");

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
    .setTitle("Account Service API")
    .setDescription(
      "Account lifecycle (create/activate/freeze/unfreeze/close). Account creation requires the " +
        "customer's KYC to be approved. See PRD section 9.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.ACCOUNT_SERVICE_PORT ?? 3004;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`account-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`account-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
