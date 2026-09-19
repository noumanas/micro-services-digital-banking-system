import { Module } from "@nestjs/common";
import { FraudModule } from "../fraud/fraud.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [FraudModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
