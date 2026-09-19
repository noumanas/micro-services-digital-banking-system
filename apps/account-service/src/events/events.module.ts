import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [AccountsModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
