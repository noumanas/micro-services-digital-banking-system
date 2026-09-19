import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { KycVerification } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class KycService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/kyc/verifications`;

  submit(customerId: string, simulate?: 'approve' | 'reject') {
    return this.http.post<KycVerification>(this.baseUrl, { customerId, simulate });
  }

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<KycVerification[]>(this.baseUrl, { params });
  }
}
