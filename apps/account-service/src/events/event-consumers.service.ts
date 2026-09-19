import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainEventConsumer, ensureTopics, topicForEvent } from "@digital-banking/events";
import { AccountsService } from "../accounts/accounts.service";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";

const CONSUMER_NAME = "account-service";
const TOPICS = ["KycApproved", "KycRejected"].map(topicForEvent);

@Injectable()
export class EventConsumersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumersService.name);
  private readonly consumer: DomainEventConsumer;
  private readonly clientId: string;
  private readonly brokers: string[];

  constructor(
    config: ConfigService,
    private readonly accountsService: AccountsService,
    private readonly deadLetters: DeadLetterPrismaRepository,
  ) {
    this.clientId = config.get<string>("KAFKA_CLIENT_ID", CONSUMER_NAME);
    this.brokers = config.get<string>("KAFKA_BROKERS", "localhost:9092").split(",");
    this.consumer = new DomainEventConsumer({
      clientId: this.clientId,
      brokers: this.brokers,
      groupId: CONSUMER_NAME,
    });
  }

  async onModuleInit(): Promise<void> {
    await ensureTopics({ clientId: this.clientId, brokers: this.brokers }, TOPICS);
    await this.consumer.connect();

    await this.consumer.run(
      async (event) => {
        switch (event.eventType) {
          case "KycApproved":
            await this.accountsService.handleKycDecision(event as never, true);
            return;
          case "KycRejected":
            await this.accountsService.handleKycDecision(event as never, false);
            return;
          default:
            this.logger.warn(`Unhandled event type: ${event.eventType}`);
        }
      },
      {
        topics: TOPICS,
        maxRetries: 3,
        onDeadLetter: async (event, rawValue, error, retryCount) => {
          this.logger.error(
            `Dead-lettering event ${event?.eventId ?? "unknown"} (${event?.eventType ?? "unknown"}) after ${retryCount} attempts: ${error.message}`,
          );
          await this.deadLetters.record({
            consumerName: CONSUMER_NAME,
            topic: event ? topicForEvent(event.eventType) : "unknown",
            event,
            rawValue,
            errorMessage: error.message,
            retryCount,
          });
        },
      },
    );

    this.logger.log(`Subscribed to: ${TOPICS.join(", ")}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
