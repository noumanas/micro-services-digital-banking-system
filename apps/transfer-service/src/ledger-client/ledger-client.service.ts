import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { signServiceToken } from "@digital-banking/auth";
import { Permission } from "@digital-banking/shared";
import { ConflictDomainError } from "@digital-banking/shared";

export interface PostLedgerTransferInput {
  tenantId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface LedgerTransferResult {
  id: string;
}

// The one synchronous, service-to-service call in the whole saga (PRD
// section 30: ledger posting requires strong consistency, so transfer-service
// waits for the definitive result here rather than firing an event and
// hoping). Authenticates with a short-lived SERVICE token, not the
// customer's own — by the time this runs we're inside an async Kafka
// consumer callback with no HTTP request/JWT to forward anyway.
@Injectable()
export class LedgerClientService {
  constructor(private readonly config: ConfigService) {}

  async postTransfer(input: PostLedgerTransferInput): Promise<LedgerTransferResult> {
    const token = signServiceToken(this.config.get<string>("JWT_ACCESS_SECRET")!, {
      producer: "transfer-service",
      tenantId: input.tenantId,
      permissions: [Permission.LEDGER_TRANSFER],
    });

    const baseUrl = this.config.get<string>("LEDGER_SERVICE_URL")!;
    const response = await fetch(`${baseUrl}/v1/ledger/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }));
      throw new ConflictDomainError(body.message ?? `Ledger posting failed with status ${response.status}`);
    }

    return response.json();
  }
}
