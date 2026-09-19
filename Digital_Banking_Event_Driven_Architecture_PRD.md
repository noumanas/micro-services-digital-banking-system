# PRD — Event-Driven Digital Banking SaaS Platform

**Version:** 1.0  
**Date:** 2026-08-23  
**Status:** Draft  
**Architecture:** Event-Driven Microservices  
**Primary Backend:** Node.js + TypeScript + NestJS

---

## 1. Product Overview

### 1.1 Product Name

**Digital Banking Core — Event-Driven Banking SaaS**

### 1.2 Product Vision

Build a multi-tenant digital banking platform that provides financial institutions, fintech companies, and regulated banking partners with APIs and operational services for customer onboarding, accounts, balances, payments, transfers, cards, transaction processing, notifications, fraud controls, and reporting.

The platform should be designed around an **event-driven architecture** so that banking operations remain decoupled, auditable, scalable, and resilient.

### 1.3 Business Model

The platform is intended as a B2B/B2B2C SaaS product.

Potential customers:

- Fintech startups
- Digital banks
- Microfinance institutions
- Payment companies
- Banking-as-a-Service providers
- Financial institutions building digital channels
- Companies requiring embedded banking capabilities

Potential pricing:

- Monthly platform fee
- Per active customer
- Per account
- Per transaction
- API usage
- Premium compliance/risk modules
- Enterprise/on-premise deployment

> **Important:** This PRD describes a software platform and does not itself provide a regulatory license to operate a bank or payment institution. Production deployment must comply with the laws, licensing requirements, AML/KYC requirements, data-protection requirements, and banking/payment regulations applicable to each operating jurisdiction.

---

# 2. Problem Statement

Traditional core banking systems can be expensive, difficult to integrate, tightly coupled, and slow to change.

Modern fintechs need:

- API-first banking capabilities
- Real-time transaction processing
- Scalable account services
- Reliable payment processing
- Strong auditability
- Automated notifications
- Fraud/risk integration
- Easy integration with mobile/web applications
- Configurable business rules
- Multi-tenant architecture

The proposed platform solves this by separating banking capabilities into independently deployable services connected through domain events.

---

# 3. Goals

## 3.1 Primary Goals

1. Provide API-first digital banking capabilities.
2. Support multi-tenant financial institutions.
3. Process financial transactions reliably.
4. Maintain an immutable audit trail.
5. Decouple services using asynchronous domain events.
6. Support real-time balance and transaction updates.
7. Provide reliable payment and transfer workflows.
8. Support KYC/AML integrations.
9. Provide operational dashboards and reporting.
10. Scale individual services independently.

## 3.2 Non-Goals for MVP

The MVP will not attempt to:

- Replace a country's regulatory banking infrastructure.
- Become a card network.
- Issue physical cards directly without external processors.
- Perform regulatory compliance automatically without configurable rules and approved providers.
- Provide lending underwriting as the initial core feature.
- Implement cryptocurrency banking.

---

# 4. Target Users

## 4.1 Banking Institution Administrator

Manages:

- Organization
- Branches
- Products
- Accounts
- Users
- Limits
- Fees
- Operational configuration

## 4.2 Bank Operations Officer

Manages:

- Customers
- Accounts
- Transactions
- Transfers
- Exceptions
- Reconciliation

## 4.3 Compliance Officer

Manages:

- KYC
- AML alerts
- Suspicious activity
- Customer risk
- Transaction monitoring
- Case management

## 4.4 Customer

Uses:

- Mobile application
- Web application
- Accounts
- Transfers
- Payments
- Statements
- Cards

## 4.5 Developer / API Consumer

Integrates the banking platform with:

- Mobile apps
- Web apps
- Merchant systems
- Payment systems
- External financial services

---

# 5. High-Level Architecture

```text
                        API Gateway
                             |
          +------------------+------------------+
          |                  |                  |
      Web App            Mobile App       External APIs
          |                  |                  |
          +------------------+------------------+
                             |
                      Authentication
                             |
                    Banking API Layer
                             |
        +--------------------+--------------------+
        |                    |                    |
   Customer Service     Account Service      Payment Service
        |                    |                    |
        +--------------------+--------------------+
                             |
                       Event Broker
                    Kafka / RabbitMQ / PubSub
                             |
       +----------+----------+----------+----------+
       |          |          |          |          |
    Ledger     Fraud      KYC/AML   Notification Analytics
    Service    Service     Service     Service
       |          |          |          |          |
       +----------+----------+----------+----------+
                             |
                      Reporting Service
                             |
                       Data Warehouse
```

---

# 6. Recommended Technology Stack

## Backend

- Node.js
- TypeScript
- NestJS
- REST APIs
- gRPC for selected internal synchronous calls

## Event Infrastructure

Recommended production options:

- Apache Kafka for high-volume event streaming
- RabbitMQ for queue-oriented workflows
- Google Pub/Sub for GCP-native deployment

### Initial Recommendation

For this SaaS platform:

**Node.js + NestJS + PostgreSQL + Kafka + Redis**

Kafka should be used for durable domain events and asynchronous service communication.

RabbitMQ may be preferable if the initial product has lower event volume and simpler queue-based workflows.

---

# 7. Core Microservices

## 7.1 API Gateway

Responsibilities:

- Request routing
- Authentication
- Rate limiting
- API versioning
- Tenant identification
- Request validation
- Correlation ID generation

---

## 7.2 Identity Service

Responsibilities:

- User authentication
- MFA
- Password management
- Session/token management
- OAuth/OIDC integration
- Roles and permissions

Events:

- `UserRegistered`
- `UserAuthenticated`
- `MfaEnabled`
- `UserLocked`

---

## 7.3 Customer Service

Responsibilities:

- Customer profiles
- Customer lifecycle
- Contact information
- Customer status
- KYC status

Events:

- `CustomerCreated`
- `CustomerUpdated`
- `CustomerKycSubmitted`
- `CustomerKycApproved`
- `CustomerKycRejected`

---

# 8. KYC / AML Service

Responsibilities:

- KYC workflow
- Identity verification provider integration
- Document verification
- Customer risk scoring
- AML screening
- Sanctions screening
- Transaction monitoring

Events:

- `KycVerificationRequested`
- `KycApproved`
- `KycRejected`
- `CustomerRiskChanged`
- `TransactionFlagged`

External providers should be abstracted behind provider adapters.

---

# 9. Account Service

Responsibilities:

- Create accounts
- Close accounts
- Freeze/unfreeze accounts
- Account status
- Account metadata
- Account product configuration

Example account types:

- Current account
- Savings account
- Business account
- Wallet account

Events:

- `AccountCreated`
- `AccountActivated`
- `AccountFrozen`
- `AccountUnfrozen`
- `AccountClosed`

---

# 10. Ledger Service

The ledger is the financial source of truth.

Responsibilities:

- Double-entry bookkeeping
- Journal entries
- Debit/credit postings
- Transaction references
- Ledger balances
- Reversal entries
- Financial audit trail

### Core Principle

Never update financial balances without creating corresponding ledger entries.

Example:

```text
Customer A sends $100 to Customer B

Debit:
Customer A Ledger       -$100

Credit:
Customer B Ledger       +$100
```

The ledger should use immutable journal entries.

Corrections should create reversal/correction entries instead of modifying historical financial records.

---

# 11. Payment Service

Responsibilities:

- Payment initiation
- Payment authorization
- Payment processing
- Payment status
- Payment reversal
- External payment provider integration

Events:

- `PaymentInitiated`
- `PaymentAuthorized`
- `PaymentCompleted`
- `PaymentFailed`
- `PaymentReversed`

---

# 12. Transfer Service

Supports:

- Internal transfers
- Bank transfers
- Scheduled transfers
- Beneficiaries
- Transfer limits

Events:

- `TransferInitiated`
- `TransferValidated`
- `TransferCompleted`
- `TransferFailed`
- `TransferReversed`

---

# 13. Card Service

The platform should integrate with external card processors.

Responsibilities:

- Card lifecycle
- Virtual cards
- Physical card requests
- Card status
- Card limits
- Card transaction events

Events:

- `CardIssued`
- `CardActivated`
- `CardBlocked`
- `CardTransactionReceived`

---

# 14. Notification Service

Channels:

- Email
- SMS
- Push notifications
- In-app notifications

Events consumed:

- `PaymentCompleted`
- `TransferCompleted`
- `AccountCreated`
- `CardBlocked`
- `KycApproved`

The notification service must be asynchronous and should not block financial transactions.

---

# 15. Fraud / Risk Service

Responsibilities:

- Transaction risk scoring
- Velocity checks
- Geographic checks
- Device risk
- Behavioral rules
- Suspicious transaction detection

Events consumed:

- `TransactionInitiated`
- `PaymentInitiated`
- `TransferInitiated`

Events produced:

- `TransactionApproved`
- `TransactionFlagged`
- `TransactionBlocked`

---

# 16. Event-Driven Architecture

## 16.1 Event Flow Example

Customer initiates transfer:

```text
Mobile App
    |
    v
API Gateway
    |
    v
Transfer Service
    |
    | TransferInitiated
    v
Kafka
    |
    +----> Fraud Service
    |
    +----> Limit Service
    |
    +----> Notification Service
    |
    +----> Analytics Service
    |
    v
Transfer Processing
    |
    | TransferCompleted
    v
Kafka
    |
    +----> Ledger Service
    +----> Notification Service
    +----> Reporting Service
```

---

# 17. Event Catalog

| Event | Producer | Consumers |
|---|---|---|
| `CustomerCreated` | Customer | KYC, Notification, Analytics |
| `KycApproved` | KYC | Customer, Account |
| `AccountCreated` | Account | Ledger, Notification |
| `TransferInitiated` | Transfer | Fraud, Limits |
| `TransferApproved` | Fraud | Transfer |
| `TransferCompleted` | Transfer | Ledger, Notification, Analytics |
| `PaymentInitiated` | Payment | Fraud, Limits |
| `PaymentCompleted` | Payment | Ledger, Notification |
| `PaymentFailed` | Payment | Notification, Analytics |
| `CardTransactionReceived` | Card | Fraud, Ledger |
| `TransactionFlagged` | Fraud | Compliance, Case Management |
| `AccountFrozen` | Account | Payment, Transfer, Notification |

---

# 18. Event Schema

All domain events should follow a standard envelope.

```json
{
  "eventId": "uuid",
  "eventType": "TransferCompleted",
  "eventVersion": 1,
  "occurredAt": "2026-08-23T15:30:00Z",
  "tenantId": "tenant-123",
  "correlationId": "request-456",
  "causationId": "event-789",
  "producer": "transfer-service",
  "aggregateType": "transfer",
  "aggregateId": "transfer-123",
  "data": {
    "amount": 1000,
    "currency": "USD",
    "sourceAccountId": "acc-001",
    "destinationAccountId": "acc-002"
  }
}
```

---

# 19. Event Design Rules

Every event must have:

- Unique event ID
- Event type
- Version
- Timestamp
- Tenant ID
- Correlation ID
- Causation ID
- Aggregate ID
- Producer
- Payload

Events should be immutable.

Consumers should be able to safely process an event more than once.

---

# 20. Outbox Pattern

Financial services must not rely on:

```text
Database transaction
       +
Message broker publish
```

without transactional coordination.

Use the **Transactional Outbox Pattern**.

```text
Service
  |
  +---- Database Transaction
  |          |
  |          +---- Business Data
  |          |
  |          +---- Outbox Event
  |
  v
Outbox Publisher
  |
  v
Kafka
```

This prevents a transaction from succeeding while its event publication fails.

---

# 21. Idempotency

All financial write APIs must support idempotency.

Example:

```http
POST /v1/transfers
Idempotency-Key: 5c8d...
```

If the same request is submitted twice:

```text
Request 1 -> Transfer Created
Request 2 -> Existing Transfer Returned
```

No duplicate financial transaction should be created.

---

# 22. Retry and Dead Letter Queue

Failed event processing:

```text
Kafka
  |
Consumer
  |
Failure
  |
Retry 1
  |
Retry 2
  |
Retry 3
  |
DLQ
```

The DLQ should preserve:

- Original event
- Error message
- Stack trace
- Consumer name
- Retry count
- Failed timestamp

Operations staff should be able to inspect and replay safe events.

---

# 23. Database Architecture

Recommended database:

**PostgreSQL**

Each service should own its data.

```text
Customer Service -> customer_db
Account Service  -> account_db
Ledger Service   -> ledger_db
Payment Service  -> payment_db
KYC Service      -> kyc_db
```

Avoid direct cross-service database access.

Services communicate through APIs/events.

---

# 24. Ledger Database

Example:

```text
accounts
--------
id
tenant_id
customer_id
currency
status

ledger_accounts
---------------
id
account_id
type
currency

journal_entries
---------------
id
transaction_id
reference
created_at

journal_lines
-------------
id
journal_entry_id
ledger_account_id
debit
credit
currency
```

Financial records should be append-only.

---

# 25. Multi-Tenancy

Every business entity must be associated with:

```text
tenant_id
```

Example:

```text
tenant
  |
  +-- customers
  +-- accounts
  +-- transactions
  +-- users
  +-- products
```

Tenant isolation must be enforced at:

- API layer
- Service layer
- Database layer
- Event layer
- Authorization layer

---

# 26. Security

Required controls:

- TLS everywhere
- Encryption at rest
- OAuth 2.0/OIDC
- MFA
- RBAC
- API rate limiting
- Secrets management
- Audit logging
- Database access controls
- Network segmentation
- Input validation
- Secure headers
- Dependency scanning
- Vulnerability management

Sensitive financial and personal information must be minimized and protected.

---

# 27. Roles and Permissions

Example:

```text
SUPER_ADMIN
BANK_ADMIN
OPERATIONS
COMPLIANCE_OFFICER
FINANCE_OFFICER
CUSTOMER_SUPPORT
CUSTOMER
API_CLIENT
```

Permissions should be granular.

Example:

```text
transfer:create
transfer:approve
transfer:cancel
account:freeze
account:unfreeze
customer:read
customer:update
transaction:read
transaction:reverse
```

High-risk operations should support maker-checker / four-eyes approval where required.

---

# 28. API Design

## Authentication

```http
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
```

## Customers

```http
POST /v1/customers
GET /v1/customers/:id
PATCH /v1/customers/:id
```

## Accounts

```http
POST /v1/accounts
GET /v1/accounts/:id
GET /v1/accounts/:id/balance
POST /v1/accounts/:id/freeze
```

## Transfers

```http
POST /v1/transfers
GET /v1/transfers/:id
POST /v1/transfers/:id/cancel
```

## Transactions

```http
GET /v1/transactions
GET /v1/transactions/:id
```

---

# 29. Example Transfer Workflow

```text
1. Customer submits transfer.
2. API validates authentication.
3. Idempotency key is checked.
4. Transfer Service creates transfer.
5. Transactional outbox records TransferInitiated.
6. Event is published.
7. Fraud Service evaluates transaction.
8. Limit Service validates limits.
9. Transfer is approved.
10. Ledger Service creates journal entries.
11. Transfer becomes completed.
12. TransferCompleted event is published.
13. Notification Service sends confirmation.
14. Analytics Service records transaction.
```

---

# 30. Consistency Model

Not every operation requires synchronous consistency.

### Strong consistency

Use for:

- Ledger posting
- Available balance
- Transaction authorization
- Idempotency

### Eventual consistency

Use for:

- Notifications
- Analytics
- Reporting
- Search indexes
- Customer activity feeds

---

# 31. Saga Pattern

Distributed financial workflows should use a Saga/state-machine approach where appropriate.

Example:

```text
TransferRequested
      |
      v
RiskCheck
      |
      v
LimitCheck
      |
      v
Debit Source
      |
      v
Credit Destination
      |
      v
TransferCompleted
```

If an operation fails, use a compensating action where appropriate.

For financial records, compensation should normally be represented through explicit reversal/correction ledger entries rather than destructive database updates.

---

# 32. Audit Trail

Every important action must produce an audit record.

Audit examples:

```text
USER_LOGIN
ACCOUNT_CREATED
ACCOUNT_FROZEN
TRANSFER_CREATED
TRANSFER_APPROVED
TRANSFER_REVERSED
KYC_APPROVED
CARD_BLOCKED
```

Audit records should include:

- Actor
- Tenant
- Action
- Resource
- Timestamp
- IP/device metadata where legally appropriate
- Correlation ID
- Result

---

# 33. Observability

Use:

- OpenTelemetry
- Prometheus-compatible metrics
- Grafana
- Centralized logs
- Distributed tracing

Every request/event should have:

```text
traceId
correlationId
eventId
```

Important metrics:

- Transaction success rate
- Payment latency
- Event processing latency
- Consumer lag
- Failed events
- DLQ size
- API latency
- Database latency
- Fraud rejection rate

---

# 34. Deployment Architecture

Initial cloud architecture:

```text
                    Cloud Load Balancer
                           |
                      API Gateway
                           |
                    Kubernetes / Cloud Run
                           |
          +----------------+----------------+
          |                |                |
      Auth Service    Account Service   Payment Service
          |                |                |
          +----------------+----------------+
                           |
                         Kafka
                           |
        +----------+-------+-------+----------+
        |          |               |          |
      Ledger     Fraud           KYC       Notification
        |
     PostgreSQL
```

For an MVP, Docker Compose can be used locally.

Production can use:

- Kubernetes
- Google Cloud Run
- AWS ECS/EKS
- Azure Container Apps/AKS

depending on operational requirements.

---

# 35. Node.js Project Structure

```text
digital-banking/
│
├── apps/
│   ├── api-gateway/
│   ├── identity-service/
│   ├── customer-service/
│   ├── kyc-service/
│   ├── account-service/
│   ├── ledger-service/
│   ├── payment-service/
│   ├── transfer-service/
│   ├── card-service/
│   ├── fraud-service/
│   ├── notification-service/
│   └── reporting-service/
│
├── packages/
│   ├── events/
│   ├── database/
│   ├── auth/
│   ├── observability/
│   ├── config/
│   └── shared/
│
├── infrastructure/
│   ├── docker/
│   ├── kafka/
│   ├── postgres/
│   ├── redis/
│   └── kubernetes/
│
├── docs/
│   ├── architecture/
│   ├── events/
│   └── api/
│
└── package.json
```

A monorepo can be implemented using:

- Nx
- Turborepo
- pnpm workspaces

---

# 36. Development Phases

## Phase 1 — Foundation

- Monorepo
- NestJS
- TypeScript
- PostgreSQL
- Redis
- Kafka
- Docker
- Authentication
- Tenant management
- Observability

## Phase 2 — Customer & Accounts

- Customer service
- KYC integration interface
- Account service
- Account lifecycle
- Basic dashboard

## Phase 3 — Ledger

- Double-entry ledger
- Journal entries
- Balance calculation
- Transaction history
- Reversal mechanism

## Phase 4 — Transfers

- Internal transfers
- Idempotency
- Limits
- Fraud integration
- Transfer state machine
- Notifications

## Phase 5 — Payments & Cards

- Payment provider adapters
- Card processor adapter
- Webhooks
- Card lifecycle
- Card transactions

## Phase 6 — Compliance

- AML rules
- Risk scoring
- Sanctions provider
- Case management
- Audit reporting

## Phase 7 — Production

- High availability
- Disaster recovery
- Backups
- Monitoring
- Security testing
- Load testing
- Penetration testing
- Compliance readiness

---

# 37. MVP Scope

The first production-oriented MVP should contain:

### Customer

- Registration
- Authentication
- Profile
- KYC status

### Accounts

- Create account
- View balance
- Freeze account
- Account history

### Ledger

- Double-entry transactions
- Credits
- Debits
- Reversals
- Immutable journal

### Transfers

- Internal transfers
- Transfer status
- Idempotency
- Limits

### Events

- Kafka
- Event schemas
- Outbox
- Consumers
- Retry
- DLQ

### Notifications

- Email
- Push
- Transaction notifications

### Admin

- Customer management
- Account management
- Transaction monitoring
- Audit logs

---

# 38. MVP Success Criteria

The MVP is successful when:

1. A tenant can create customers.
2. Customers can pass a configurable KYC workflow.
3. Customers can create accounts.
4. Accounts can receive funds.
5. Customers can transfer funds.
6. Every financial movement creates ledger entries.
7. Duplicate requests cannot create duplicate transfers.
8. Domain events are published reliably.
9. Failed event processing is retried.
10. Poison events reach the DLQ.
11. Operators can audit important actions.
12. Services can scale independently.
13. Financial operations remain correct during service failures.

---

# 39. Reliability Requirements

Target:

- 99.9%+ API availability for MVP production
- No lost committed financial transactions
- No duplicate financial posting caused by message redelivery
- Durable event storage
- Automated backups
- Disaster recovery procedures
- Graceful degradation for non-critical services

Notification or analytics failure must not cause a successful financial transaction to become financially inconsistent.

---

# 40. Testing Strategy

## Unit Testing

- Jest
- Domain logic
- Ledger calculations
- Validation
- Event handlers

## Integration Testing

- PostgreSQL
- Kafka
- Redis
- External provider mocks

## Contract Testing

Validate event schemas between producers and consumers.

## End-to-End Testing

Example:

```text
Create Customer
      ↓
Complete KYC
      ↓
Create Account
      ↓
Fund Account
      ↓
Create Transfer
      ↓
Fraud Check
      ↓
Ledger Posting
      ↓
Transfer Completed
      ↓
Notification
```

## Load Testing

Use:

- k6
- Artillery

Test:

- API throughput
- Event throughput
- Consumer lag
- Database contention
- Concurrent transfers

---

# 41. Failure Scenarios

The system must handle:

### Kafka unavailable

Financial service commits business transaction and outbox event. Publisher sends event after Kafka recovers.

### Consumer crashes

Event remains available for retry.

### Duplicate event

Consumer checks processed-event/idempotency state.

### Notification provider unavailable

Financial transaction remains successful; notification retries asynchronously.

### Payment provider timeout

Payment remains in an appropriate pending state until reconciliation/webhook processing resolves it.

### Database failure

Service fails safely and does not acknowledge successful financial processing without durable persistence.

---

# 42. Reconciliation

External financial providers can disagree with internal state.

Implement reconciliation jobs for:

- Payments
- Cards
- Bank transfers
- Settlement
- Fees

Example:

```text
External Provider
       |
       v
Provider Transactions
       |
       v
Reconciliation Service
       |
       +---- Match
       |
       +---- Mismatch
              |
              v
        Operations Case
```

---

# 43. Reporting

Reports:

- Account statement
- Transaction report
- Daily settlement
- Fees
- Customer activity
- Transfer report
- Failed transactions
- Fraud report
- Reconciliation report

Reporting should preferably read from a dedicated reporting/read model rather than putting heavy analytical queries on the transactional ledger database.

---

# 44. Future Features

Potential future modules:

- Loans
- Credit scoring
- Savings products
- Interest calculation
- Fixed deposits
- Merchant accounts
- Merchant payments
- International transfers
- FX
- Open banking
- Embedded finance APIs
- Business banking
- Payroll
- Investment integrations
- AI fraud detection
- AI customer support
- Personalized financial insights

---

# 45. Recommended Architecture Principles

1. **Ledger is the financial source of truth.**
2. **Financial records are immutable.**
3. **Use events for domain communication.**
4. **Use APIs for synchronous queries/commands where appropriate.**
5. **Use the Outbox Pattern for reliable event publishing.**
6. **Make consumers idempotent.**
7. **Use explicit transaction state machines.**
8. **Never depend on notifications for financial correctness.**
9. **Do not share databases directly between services.**
10. **Every event must be traceable.**
11. **Every financial operation must be auditable.**
12. **Design for reconciliation from the beginning.**
13. **Treat security and compliance as platform requirements, not add-ons.**

---

# 46. Final Product Architecture

```text
                         ┌──────────────────┐
                         │  Mobile / Web    │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │   API Gateway    │
                         └────────┬─────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
┌──────▼──────┐           ┌───────▼──────┐           ┌───────▼──────┐
│   Identity  │           │   Customer   │           │   Account    │
└──────┬──────┘           └───────┬──────┘           └───────┬──────┘
       │                          │                          │
       └──────────────────────────┼──────────────────────────┘
                                  │
                           ┌──────▼───────┐
                           │ Event Broker │
                           │    Kafka     │
                           └──────┬───────┘
                                  │
       ┌──────────────┬───────────┼──────────────┬──────────────┐
       │              │           │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌───▼──────┐ ┌─────▼─────┐ ┌──────▼─────┐
│   Ledger    │ │  Payment  │ │ Transfer │ │   Fraud   │ │    KYC      │
└──────┬──────┘ └─────┬─────┘ └───┬──────┘ └─────┬─────┘ └──────┬─────┘
       │              │           │              │              │
       └──────────────┴───────────┼──────────────┴──────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ Notification / Reporting  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ Analytics / Data Platform │
                    └───────────────────────────┘
```

---

# 47. Definition of Done

A feature is considered complete when:

- API implemented
- Authentication/authorization implemented
- Database migrations implemented
- Domain events defined
- Outbox implemented where required
- Event consumers implemented
- Idempotency implemented for relevant commands
- Retry/DLQ behavior implemented
- Unit tests written
- Integration tests written
- API documentation updated
- Event documentation updated
- Logging/tracing implemented
- Audit requirements implemented
- Security review completed
- Monitoring implemented
- Failure scenarios tested
- Deployment configuration completed

---

# 48. Conclusion

The proposed Digital Banking SaaS should be built as an **API-first, event-driven banking platform** rather than a single large Node.js application.

The most important architectural boundary is the financial ledger. Banking services such as accounts, transfers, payments, fraud, KYC, notifications, and reporting should interact through well-defined APIs and domain events while maintaining clear ownership of their data.

The combination of:

**Node.js + TypeScript + NestJS + PostgreSQL + Kafka + Redis + Transactional Outbox + Idempotent Consumers + Double-Entry Ledger + OpenTelemetry**

provides a strong foundation for building a scalable digital banking platform.

Production financial use requires jurisdiction-specific legal, regulatory, security, compliance, and operational review before customer funds or regulated payment activity are handled.
