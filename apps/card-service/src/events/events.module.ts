import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [CardsModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
