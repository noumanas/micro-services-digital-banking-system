import { DomainEvent } from "../envelope";
import { DomainEventProducer } from "../kafka/kafka-producer";

export interface OutboxRecord {
  id: string;
  event: DomainEvent;
}

// Implemented per-service against its own outbox table (see PRD section 20).
// The publisher never writes business data — it only reads rows the business
// transaction already committed and marks them published/failed.
export interface OutboxRepository {
  findUnpublished(limit: number): Promise<OutboxRecord[]>;
  markPublished(id: string): Promise<void>;
  markFailed(id: string, error: Error): Promise<void>;
}

export interface OutboxPublisherOptions {
  pollIntervalMs?: number;
  batchSize?: number;
}

export class OutboxPublisher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly producer: DomainEventProducer,
    private readonly options: OutboxPublisherOptions = {},
  ) {}

  start(): void {
    if (this.timer) return;
    const interval = this.options.pollIntervalMs ?? 1000;
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const batch = await this.repository.findUnpublished(this.options.batchSize ?? 50);
      for (const record of batch) {
        try {
          await this.producer.publish(record.event);
          await this.repository.markPublished(record.id);
        } catch (err) {
          await this.repository.markFailed(record.id, err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      this.running = false;
    }
  }
}
