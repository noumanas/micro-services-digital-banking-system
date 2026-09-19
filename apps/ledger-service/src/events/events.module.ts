import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [LedgerModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
