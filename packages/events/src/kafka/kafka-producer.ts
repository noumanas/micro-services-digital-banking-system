import { Kafka, Producer, logLevel } from "kafkajs";
import { DomainEvent } from "../envelope";
import { topicForEvent } from "../envelope";

export interface KafkaProducerConfig {
  clientId: string;
  brokers: string[];
}

// Thin wrapper around kafkajs so services never touch the client directly.
// Publishing happens from the OutboxPublisher, never inline with a business
// transaction — see PRD section 20 (Outbox Pattern).
export class DomainEventProducer {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private connected = false;

  constructor(config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      logLevel: logLevel.WARN,
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  async publish(event: DomainEvent, topicOverride?: string): Promise<void> {
    const topic = topicOverride ?? topicForEvent(event.eventType);
    await this.producer.send({
      topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.eventType,
            eventId: event.eventId,
            tenantId: event.tenantId,
            correlationId: event.correlationId,
          },
        },
      ],
    });
  }
}
