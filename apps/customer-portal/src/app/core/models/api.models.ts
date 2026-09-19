// Shapes returned by the gateway — kept in sync with each service's DTOs/entities by hand.

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
}

export interface AccessTokenPayload {
  sub: string; // userId == customerId
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}

export interface Customer {
  id: string;
  tenantId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface KycVerification {
  id: string;
  tenantId: string;
  customerId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  provider: string;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type AccountType = 'CURRENT' | 'SAVINGS' | 'BUSINESS' | 'WALLET';
export type AccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface Account {
  id: string;
  tenantId: string;
  customerId: string;
  type: AccountType;
  currency: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Balance {
  accountId: string;
  currency: string;
  balance: number;
}

export interface LedgerEntryLine {
  journalEntryId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  reference: string;
  description: string | null;
  counterpartyCustomerId: string | null;
  createdAt: string;
}

export interface CustomerDisplayName {
  id: string;
  name: string;
}

export type TransferStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'FLAGGED' | 'CANCELLED';

export interface Transfer {
  id: string;
  tenantId: string;
  customerId: string;
  idempotencyKey: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  status: TransferStatus;
  failureReason: string | null;
  journalEntryId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type PaymentDirection = 'INBOUND' | 'OUTBOUND';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Payment {
  id: string;
  tenantId: string;
  customerId: string;
  accountId: string;
  direction: PaymentDirection;
  amount: number;
  currency: string;
  provider: string;
  externalReference: string | null;
  idempotencyKey: string;
  status: PaymentStatus;
  failureReason: string | null;
  journalEntryId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type CardType = 'VIRTUAL' | 'PHYSICAL';
export type CardStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'CLOSED';

export interface Card {
  id: string;
  tenantId: string;
  customerId: string;
  accountId: string;
  type: CardType;
  last4: string;
  status: CardStatus;
  dailyLimit: number;
  createdAt: string;
  activatedAt: string | null;
  blockedAt: string | null;
}

export interface CardTransaction {
  id: string;
  tenantId: string;
  cardId: string;
  accountId: string;
  amount: number;
  currency: string;
  merchantName: string;
  status: 'APPROVED' | 'DECLINED';
  declineReason: string | null;
  journalEntryId: string | null;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  tenantId: string;
  customerId: string;
  channel: string;
  eventType: string;
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED';
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  tenantId: string;
  customerId: string;
  type: 'TRANSFER' | 'PAYMENT' | 'CARD';
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  description: string | null;
  occurredAt: string;
}

export interface ActivitySummary {
  customerId: string;
  sinceDays: number;
  transactionCount: number;
  totalDebits: number;
  totalCredits: number;
  byType: Record<string, number>;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  correlationId?: string;
}
