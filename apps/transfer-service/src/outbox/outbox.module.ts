import { Module } from "@nestjs/common";
import { OutboxPrismaRepository } from "./outbox-prisma.repository";
import { OutboxPublisherService } from "./outbox-publisher.provider";

@Module({
  providers: [OutboxPrismaRepository, OutboxPublisherService],
  exports: [OutboxPrismaRepository],
})
export class OutboxModule {}
