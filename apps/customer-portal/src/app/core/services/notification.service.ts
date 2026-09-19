import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { NotificationLog } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/notifications`;

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<NotificationLog[]>(this.baseUrl, { params });
  }
}
