import { Module } from "@nestjs/common";
import { ProviderModule } from "../provider/provider.module";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";

@Module({
  imports: [ProviderModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
