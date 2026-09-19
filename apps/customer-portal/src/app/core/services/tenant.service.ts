import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RegisterResponse, Tenant, TenantUser } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/tenants`;

  list() {
    return this.http.get<Tenant[]>(this.baseUrl);
  }

  get(tenantId: string) {
    return this.http.get<Tenant>(`${this.baseUrl}/${tenantId}`);
  }

  listUsers(tenantId: string) {
    return this.http.get<TenantUser[]>(`${this.baseUrl}/${tenantId}/users`);
  }

  // Provisions a BANK_ADMIN who can log in immediately with tenantId + email
  // + password — no self-service registration or role-promotion step needed.
  createAdmin(tenantId: string, email: string, password: string) {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/${tenantId}/admins`, { email, password });
  }
}
