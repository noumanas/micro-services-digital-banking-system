import { Kafka, Consumer, logLevel } from "kafkajs";
import { DomainEvent } from "../envelope";

export interface KafkaConsumerConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
}

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export interface ConsumeOptions {
  topics: string[];
  maxRetries?: number;
  onDeadLetter: (event: DomainEvent | null, rawValue: string, error: Error, retryCount: number) => Promise<void>;
}

// Retry + Dead Letter Queue behaviour per PRD section 22. Each message is
// retried in-process up to maxRetries times; if it still fails it is handed
// to onDeadLetter (the service is expected to persist it, e.g. a dead_letters
// table, preserving the original event, error, consumer name and retry count).
export class DomainEventConsumer {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;

  constructor(config: KafkaConsumerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.WARN,
    });
    this.consumer = this.kafka.consumer({ groupId: config.groupId });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  async run(handler: DomainEventHandler, options: ConsumeOptions): Promise<void> {
    const maxRetries = options.maxRetries ?? 3;

    for (const topic of options.topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const rawValue = message.value?.toString() ?? "";
        let event: DomainEvent | null = null;
        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt <= maxRetries) {
          try {
            event = event ?? (JSON.parse(rawValue) as DomainEvent);
            await handler(event);
            return;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            attempt += 1;
            if (attempt <= maxRetries) {
              await sleep(backoffMs(attempt));
            }
          }
        }

        await options.onDeadLetter(event, rawValue, lastError ?? new Error("Unknown consumer error"), attempt);
      },
    });
  }
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
