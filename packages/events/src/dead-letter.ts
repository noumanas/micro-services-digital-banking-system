import { DomainEvent } from "./envelope";

// PRD section 22 (Retry and Dead Letter Queue): a poison event that exhausts
// its retries is preserved here, not dropped, so operators can inspect and
// replay it.
export interface DeadLetterInput {
  consumerName: string;
  topic: string;
  event: DomainEvent | null;
  rawValue: string;
  errorMessage: string;
  retryCount: number;
}

export interface DeadLetterRepository {
  record(input: DeadLetterInput): Promise<void>;
}
