import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Customer, CustomerDisplayName } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/customers`;

  get(id: string) {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }

  // Narrow, name-only lookup — usable for any customer in the same tenant
  // (e.g. a transfer counterparty), not just yourself or as staff.
  getDisplayName(id: string) {
    return this.http.get<CustomerDisplayName>(`${this.baseUrl}/${id}/display-name`);
  }

  // Platform administration — SUPER_ADMIN viewing any tenant's customers.
  listByTenant(tenantId: string) {
    return this.http.get<Customer[]>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  update(id: string, changes: { firstName?: string; lastName?: string; phone?: string }) {
    return this.http.patch<Customer>(`${this.baseUrl}/${id}`, changes);
  }
}
