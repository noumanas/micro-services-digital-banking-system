import { Module } from "@nestjs/common";
import { LedgerClientModule } from "../ledger-client/ledger-client.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [LedgerClientModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
