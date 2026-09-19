import { Module } from "@nestjs/common";
import { LedgerClientService } from "./ledger-client.service";

@Module({
  providers: [LedgerClientService],
  exports: [LedgerClientService],
})
export class LedgerClientModule {}
