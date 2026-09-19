import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { signServiceToken } from "@digital-banking/auth";
import { ConflictDomainError, Permission } from "@digital-banking/shared";

export interface PostLedgerMovementInput {
  tenantId: string;
  accountId: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface LedgerMovementResult {
  id: string;
}

// The one synchronous, service-to-service call for each payment (PRD
// section 30: ledger posting requires strong consistency). Authenticates
// with a short-lived SERVICE token scoped to exactly the permission this
// one call needs.
@Injectable()
export class LedgerClientService {
  constructor(private readonly config: ConfigService) {}

  private async post(path: string, permission: Permission, input: PostLedgerMovementInput): Promise<LedgerMovementResult> {
    const token = signServiceToken(this.config.get<string>("JWT_ACCESS_SECRET")!, {
      producer: "payment-service",
      tenantId: input.tenantId,
      permissions: [permission],
    });

    const baseUrl = this.config.get<string>("LEDGER_SERVICE_URL")!;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: input.amount, currency: input.currency, description: input.description }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }));
      throw new ConflictDomainError(body.message ?? `Ledger posting failed with status ${response.status}`);
    }

    return response.json();
  }

  postDeposit(input: PostLedgerMovementInput): Promise<LedgerMovementResult> {
    return this.post(`/v1/ledger/accounts/${input.accountId}/deposits`, Permission.LEDGER_POST, input);
  }

  postWithdrawal(input: PostLedgerMovementInput): Promise<LedgerMovementResult> {
    return this.post(`/v1/ledger/accounts/${input.accountId}/withdrawals`, Permission.LEDGER_POST, input);
  }

  async postReversal(tenantId: string, journalEntryId: string): Promise<LedgerMovementResult> {
    const token = signServiceToken(this.config.get<string>("JWT_ACCESS_SECRET")!, {
      producer: "payment-service",
      tenantId,
      permissions: [Permission.TRANSACTION_REVERSE],
    });

    const baseUrl = this.config.get<string>("LEDGER_SERVICE_URL")!;
    const response = await fetch(`${baseUrl}/v1/ledger/entries/${journalEntryId}/reverse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }));
      throw new ConflictDomainError(body.message ?? `Ledger reversal failed with status ${response.status}`);
    }

    return response.json();
  }
}
