import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";
import { EventConsumersService } from "./event-consumers.service";

@Module({
  imports: [NotificationsModule],
  providers: [DeadLetterPrismaRepository, EventConsumersService],
})
export class EventsModule {}
