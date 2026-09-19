import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainEventProducer, OutboxPublisher } from "@digital-banking/events";
import { OutboxPrismaRepository } from "./outbox-prisma.repository";

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly producer: DomainEventProducer;
  private readonly publisher: OutboxPublisher;

  constructor(repository: OutboxPrismaRepository, config: ConfigService) {
    this.producer = new DomainEventProducer({
      clientId: config.get<string>("KAFKA_CLIENT_ID", "ledger-service"),
      brokers: config.get<string>("KAFKA_BROKERS", "localhost:9092").split(","),
    });
    this.publisher = new OutboxPublisher(repository, this.producer, { pollIntervalMs: 1000, batchSize: 50 });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.publisher.start();
    this.logger.log("Outbox publisher started");
  }

  async onModuleDestroy(): Promise<void> {
    this.publisher.stop();
    await this.producer.disconnect();
  }
}
