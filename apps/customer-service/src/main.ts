import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("customer-service");

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
    .setTitle("Customer Service API")
    .setDescription(
      "Customer profile management. Profiles are created asynchronously from identity-service's " +
        "UserRegistered event, not via direct API call. See PRD section 7.3.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.CUSTOMER_SERVICE_PORT ?? 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`customer-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`customer-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
