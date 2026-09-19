import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [CustomersModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
