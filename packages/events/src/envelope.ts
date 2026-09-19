import { randomUUID } from "node:crypto";

// Standard domain event envelope — see PRD section 18 (Event Schema) and
// section 19 (Event Design Rules). Every event on the bus must carry these
// fields so consumers can trace, dedupe, and correlate it.
export interface DomainEvent<TData = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  tenantId: string;
  correlationId: string;
  causationId: string;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  data: TData;
}

export interface CreateEventInput<TData> {
  eventType: string;
  eventVersion?: number;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  data: TData;
}

export function createDomainEvent<TData>(input: CreateEventInput<TData>): DomainEvent<TData> {
  return {
    eventId: randomUUID(),
    eventType: input.eventType,
    eventVersion: input.eventVersion ?? 1,
    occurredAt: new Date().toISOString(),
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    causationId: input.causationId ?? input.correlationId,
    producer: input.producer,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    data: input.data,
  };
}

export function topicForEvent(eventType: string): string {
  // e.g. "UserRegistered" -> "identity.user-registered"
  const kebab = eventType.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return kebab;
}
