import { Module } from "@nestjs/common";
import { LedgerClientModule } from "../ledger-client/ledger-client.module";
import { ProviderModule } from "../provider/provider.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [LedgerClientModule, ProviderModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
