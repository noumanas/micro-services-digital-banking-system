import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import {
  GlobalAuthGuard,
  JwtStrategy,
  PermissionsGuard,
  RolesGuard,
  TenantMiddleware,
} from "@digital-banking/auth";
import { validateEnv } from "./config/validate-env";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TenantsModule } from "./tenants/tenants.module";
import { OutboxModule } from "./outbox/outbox.module";
import { HealthController } from "./common/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PassportModule,
    PrismaModule,
    OutboxModule,
    AuthModule,
    TenantsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: JwtStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new JwtStrategy(config.get<string>("JWT_ACCESS_SECRET")!),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes("*");
  }
}
