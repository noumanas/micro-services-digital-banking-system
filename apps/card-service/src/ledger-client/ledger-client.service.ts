import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { signServiceToken } from "@digital-banking/auth";
import { ConflictDomainError, Permission } from "@digital-banking/shared";

export interface PostWithdrawalInput {
  tenantId: string;
  accountId: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface LedgerMovementResult {
  id: string;
}

// Card spend posts as a withdrawal against the linked account, same
// mechanism as an outbound payment (PRD section 30: strong consistency for
// ledger posting, so this is synchronous).
@Injectable()
export class LedgerClientService {
  constructor(private readonly config: ConfigService) {}

  async postWithdrawal(input: PostWithdrawalInput): Promise<LedgerMovementResult> {
    const token = signServiceToken(this.config.get<string>("JWT_ACCESS_SECRET")!, {
      producer: "card-service",
      tenantId: input.tenantId,
      permissions: [Permission.LEDGER_POST],
    });

    const baseUrl = this.config.get<string>("LEDGER_SERVICE_URL")!;
    const response = await fetch(`${baseUrl}/v1/ledger/accounts/${input.accountId}/withdrawals`, {
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
}
