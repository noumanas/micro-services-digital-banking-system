import { Kafka, logLevel } from "kafkajs";

export interface EnsureTopicsConfig {
  clientId: string;
  brokers: string[];
}

// Consumers must not rely on auto-creation racing their own subscribe call:
// a topic no producer has ever published to yet (e.g. a downstream service
// starting for the first time) can otherwise fail subscription with
// UNKNOWN_TOPIC_OR_PARTITION. Call this once before consumer.run() so the
// topics are guaranteed to exist and have an elected leader.
export async function ensureTopics(config: EnsureTopicsConfig, topics: string[]): Promise<void> {
  const kafka = new Kafka({ clientId: config.clientId, brokers: config.brokers, logLevel: logLevel.WARN });
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));
    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map((topic) => ({ topic, numPartitions: 1 })),
        waitForLeaders: true,
      });
    }
  } finally {
    await admin.disconnect();
  }
}
