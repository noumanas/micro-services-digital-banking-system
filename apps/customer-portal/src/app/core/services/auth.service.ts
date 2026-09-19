import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccessTokenPayload, AuthTokens, RegisterResponse } from '../models/api.models';
import { decodeAccessToken } from '../utils/jwt.util';

const ACCESS_TOKEN_KEY = 'banking.accessToken';
const REFRESH_TOKEN_KEY = 'banking.refreshToken';
const LAST_EMAIL_KEY = 'banking.lastEmail';

// Mirrors packages/shared's STAFF_ROLES on the backend. A staff session acts
// on behalf of the bank and has no Customer/KYC record of its own — pages
// that fetch "my customer profile" (dashboard, profile, transfers, cards,
// payments, statement, notifications) don't apply to it.
export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'BANK_ADMIN',
  'OPERATIONS',
  'COMPLIANCE_OFFICER',
  'FINANCE_OFFICER',
  'CUSTOMER_SUPPORT',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly userSubject = new BehaviorSubject<AccessTokenPayload | null>(this.readUserFromStorage());
  readonly user$ = this.userSubject.asObservable();

  get currentUser(): AccessTokenPayload | null {
    return this.userSubject.value;
  }

  get isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  /** The identity-service user id, which is also the customer id (1:1 by design). */
  get customerId(): string | null {
    return this.currentUser?.sub ?? null;
  }

  get tenantId(): string | null {
    return this.currentUser?.tenantId ?? null;
  }

  get isStaff(): boolean {
    return this.hasAnyRole(...STAFF_ROLES);
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshTokenValue(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  get lastEmail(): string {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  }

  hasPermission(permission: string): boolean {
    return this.currentUser?.permissions.includes(permission) ?? false;
  }

  hasAnyRole(...roles: string[]): boolean {
    const mine = this.currentUser?.roles ?? [];
    return roles.some((r) => mine.includes(r));
  }

  createTenant(name: string) {
    return this.http.post<{ id: string; name: string }>(`${this.baseUrl}/v1/tenants`, { name });
  }

  register(tenantId: string, email: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/v1/auth/register`, {
      tenantId,
      email,
      password,
    });
  }

  // No tenantId needed — the backend finds which tenant this email/password
  // belongs to on its own (see identity-service's login()).
  login(email: string, password: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/v1/auth/login`, { email, password }).pipe(
      tap((tokens) => {
        localStorage.setItem(LAST_EMAIL_KEY, email);
        this.storeTokens(tokens);
      }),
    );
  }

  refreshAccessToken(): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.baseUrl}/v1/auth/refresh`, { refreshToken: this.refreshTokenValue })
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  logout(): void {
    const refreshToken = this.refreshTokenValue;
    if (refreshToken) {
      // Best-effort — the user is logged out locally regardless of whether this succeeds.
      this.http.post(`${this.baseUrl}/v1/auth/logout`, { refreshToken }).subscribe({ error: () => undefined });
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.userSubject.next(null);
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    this.userSubject.next(decodeAccessToken(tokens.accessToken));
  }

  private readUserFromStorage(): AccessTokenPayload | null {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    return token ? decodeAccessToken(token) : null;
  }
}
