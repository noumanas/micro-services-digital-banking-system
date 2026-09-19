import { Module } from "@nestjs/common";
import { TransfersModule } from "../transfers/transfers.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [TransfersModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
