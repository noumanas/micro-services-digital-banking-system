import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Payment, PaymentDirection } from '../models/api.models';

export interface CreatePaymentInput {
  accountId: string;
  direction: PaymentDirection;
  amount: number;
  currency: string;
  externalReference?: string;
  simulate?: 'approve' | 'decline';
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/payments`;

  create(input: CreatePaymentInput) {
    return this.http.post<Payment>(this.baseUrl, input, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
  }

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<Payment[]>(this.baseUrl, { params });
  }

  get(id: string) {
    return this.http.get<Payment>(`${this.baseUrl}/${id}`);
  }

  reverse(id: string) {
    return this.http.post<Payment>(`${this.baseUrl}/${id}/reverse`, {});
  }
}
