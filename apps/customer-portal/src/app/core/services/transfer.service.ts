import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Transfer } from '../models/api.models';

export interface CreateTransferInput {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/transfers`;

  create(input: CreateTransferInput) {
    return this.http.post<Transfer>(this.baseUrl, input, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
  }

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<Transfer[]>(this.baseUrl, { params });
  }

  get(id: string) {
    return this.http.get<Transfer>(`${this.baseUrl}/${id}`);
  }

  cancel(id: string) {
    return this.http.post<Transfer>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
