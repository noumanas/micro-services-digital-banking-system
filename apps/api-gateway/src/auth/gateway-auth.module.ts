import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "@digital-banking/auth";

// The gateway only verifies the JWT signature/claims issued by
// identity-service (shared JWT_ACCESS_SECRET) — it never issues tokens
// itself.
@Module({
  imports: [PassportModule],
  providers: [
    {
      provide: JwtStrategy,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new JwtStrategy(config.get<string>("JWT_ACCESS_SECRET")!),
    },
  ],
})
export class GatewayAuthModule {}
