import "reflect-metadata";
import { startTracing } from "@digital-banking/observability";

startTracing("card-service");

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
    .setTitle("Card Service API")
    .setDescription(
      "Card lifecycle (issue/activate/block) and authorization webhook. Card spend posts to the ledger " +
        "as a withdrawal, same mechanism as an outbound payment. See PRD section 13.",
    )
    .setVersion("1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.CARD_SERVICE_PORT ?? 3010;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`card-service listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`card-service API docs at http://localhost:${port}/docs`);
}

bootstrap();
