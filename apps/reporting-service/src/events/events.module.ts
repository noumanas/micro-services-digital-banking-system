import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [ReportsModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
