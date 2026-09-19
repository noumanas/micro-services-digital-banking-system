import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Balance, LedgerEntryLine } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/ledger`;

  balance(accountId: string) {
    return this.http.get<Balance>(`${this.baseUrl}/accounts/${accountId}/balance`);
  }

  entries(accountId: string) {
    return this.http.get<LedgerEntryLine[]>(`${this.baseUrl}/accounts/${accountId}/entries`);
  }

  /** Staff-only manual deposit (ledger:post) — most customer funding flows
   * through payment-service's INBOUND payments instead. */
  deposit(accountId: string, amount: number, currency: string, description?: string) {
    return this.http.post(`${this.baseUrl}/accounts/${accountId}/deposits`, { amount, currency, description });
  }

  reverse(journalEntryId: string) {
    return this.http.post(`${this.baseUrl}/entries/${journalEntryId}/reverse`, {});
  }
}
