import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Account, AccountType } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/accounts`;

  create(customerId: string, type: AccountType, currency: string) {
    return this.http.post<Account>(this.baseUrl, { customerId, type, currency });
  }

  list(customerId?: string) {
    const params = customerId ? { customerId } : undefined;
    return this.http.get<Account[]>(this.baseUrl, { params });
  }

  get(id: string) {
    return this.http.get<Account>(`${this.baseUrl}/${id}`);
  }

  // Platform administration — SUPER_ADMIN viewing any tenant's accounts.
  listByTenant(tenantId: string) {
    return this.http.get<Account[]>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  activate(id: string) {
    return this.http.post<Account>(`${this.baseUrl}/${id}/activate`, {});
  }

  freeze(id: string) {
    return this.http.post<Account>(`${this.baseUrl}/${id}/freeze`, {});
  }

  unfreeze(id: string) {
    return this.http.post<Account>(`${this.baseUrl}/${id}/unfreeze`, {});
  }

  close(id: string) {
    return this.http.post<Account>(`${this.baseUrl}/${id}/close`, {});
  }
}
