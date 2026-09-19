import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [PaymentsModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
