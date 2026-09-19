import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("notification-service");

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
    .setTitle("Notification Service API")
    .setDescription(
      "Asynchronous notifications behind a provider adapter (mock provider locally). Never blocks the " +
        "financial transaction that triggered it. See PRD section 14.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.NOTIFICATION_SERVICE_PORT ?? 3008;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`notification-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`notification-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
