import { Module } from "@nestjs/common";
import { LedgerClientModule } from "../ledger-client/ledger-client.module";
import { CardsController } from "./cards.controller";
import { CardsService } from "./cards.service";

@Module({
  imports: [LedgerClientModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
