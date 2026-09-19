import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ActivitySummary, TransactionRecord } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/reports`;

  statement(customerId: string, limit = 50) {
    return this.http.get<TransactionRecord[]>(`${this.baseUrl}/customers/${customerId}/statement`, {
      params: { limit },
    });
  }

  activity(customerId: string, days = 30) {
    return this.http.get<ActivitySummary>(`${this.baseUrl}/customers/${customerId}/activity`, {
      params: { days },
    });
  }
}
