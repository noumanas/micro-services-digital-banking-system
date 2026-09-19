import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainEventConsumer, ensureTopics, topicForEvent } from "@digital-banking/events";
import { ReportsService } from "../reports/reports.service";
import { DeadLetterPrismaRepository } from "../dead-letter/dead-letter-prisma.repository";

const CONSUMER_NAME = "reporting-service";
const TOPICS = [
  "AccountCreated",
  "TransferInitiated",
  "TransferCompleted",
  "TransferFailed",
  "PaymentInitiated",
  "PaymentCompleted",
  "PaymentFailed",
  "CardTransactionReceived",
].map(topicForEvent);

@Injectable()
export class EventConsumersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumersService.name);
  private readonly consumer: DomainEventConsumer;
  private readonly clientId: string;
  private readonly brokers: string[];

  constructor(
    config: ConfigService,
    private readonly reportsService: ReportsService,
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
          case "AccountCreated": {
            const data = event.data as { accountId: string; customerId: string; currency: string };
            await this.reportsService.handleAccountCreated({
              tenantId: event.tenantId,
              accountId: data.accountId,
              customerId: data.customerId,
              currency: data.currency,
            });
            return;
          }
          case "TransferInitiated":
            await this.reportsService.handleTransferInitiated(event as never);
            return;
          case "TransferCompleted":
            await this.reportsService.handleTransferSettled(event as never, "COMPLETED");
            return;
          case "TransferFailed":
            await this.reportsService.handleTransferSettled(event as never, "FAILED");
            return;
          case "PaymentInitiated":
            await this.reportsService.handlePaymentInitiated(event as never);
            return;
          case "PaymentCompleted":
            await this.reportsService.handlePaymentSettled(event as never, "COMPLETED");
            return;
          case "PaymentFailed":
            await this.reportsService.handlePaymentSettled(event as never, "FAILED");
            return;
          case "CardTransactionReceived":
            await this.reportsService.handleCardTransaction(event as never);
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
