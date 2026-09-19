import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Card, CardTransaction, CardType } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/cards`;

  issue(accountId: string, type: CardType, dailyLimit?: number) {
    return this.http.post<Card>(this.baseUrl, { accountId, type, dailyLimit });
  }

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<Card[]>(this.baseUrl, { params });
  }

  get(id: string) {
    return this.http.get<Card>(`${this.baseUrl}/${id}`);
  }

  // Platform administration — SUPER_ADMIN viewing any tenant's cards.
  listByTenant(tenantId: string) {
    return this.http.get<Card[]>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  activate(id: string) {
    return this.http.post<Card>(`${this.baseUrl}/${id}/activate`, {});
  }

  block(id: string) {
    return this.http.post<Card>(`${this.baseUrl}/${id}/block`, {});
  }

  /** Simulates the card-network authorization webhook — a real network
   * would call this directly, no customer session involved. */
  simulateTransaction(cardId: string, amount: number, currency: string, merchantName: string) {
    return this.http.post<CardTransaction>(`${this.baseUrl}/${cardId}/transactions`, {
      amount,
      currency,
      merchantName,
    });
  }
}
