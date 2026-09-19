# Digital Banking Core

Event-driven digital banking platform. See
[Digital_Banking_Event_Driven_Architecture_PRD.md](./Digital_Banking_Event_Driven_Architecture_PRD.md)
for the full product/architecture spec.

## Status

**All phases from PRD section 36 are implemented** — eleven microservices plus the
gateway, wired together with real event choreography rather than isolated CRUD or
live cross-service calls:

```text
register (identity) ──UserRegistered──> customer-service creates the profile
        │
submit KYC (kyc-service) ──KycApproved/Rejected──> customer-service AND account-service
        │                                           each consume it independently
        ▼
create account (account) ──AccountCreated──> ledger, transfer, payment, card, and
        │                                     reporting services each build their own
        │                                     local read-model from it
        ▼
┌─── transfer ───┐   ┌─── payment ───┐   ┌──── card ────┐
│ TransferInitiated│  │ PaymentInitiated│ │card webhook →│
│  → fraud-service │  │ → mock provider │ │ mock provider│
│  → limit check   │  │ → ledger post   │ │ → ledger post│
│  → ledger post   │  └────────┬────────┘ └──────┬───────┘
└────────┬─────────┘           │                  │
         └──────────┬──────────┴──────────────────┘
                     ▼
      notification-service (emails/logs) + reporting-service
      (statements, activity summaries, transfer/failure reports)
      — both built entirely from consumed events
```

### Services

- **`api-gateway`** — correlation IDs, tenant identification, rate limiting, reverse proxy
- **`identity-service`** — registration, login, refresh/logout, transactional outbox, audit log
- **`customer-service`** — customer profiles, created **only** by consuming `UserRegistered`,
  never via a direct API call (PRD section 45, principle 3)
- **`kyc-service`** — KYC verification behind a provider adapter (`MockKycProvider` locally)
- **`account-service`** — account lifecycle (create/activate/freeze/unfreeze/close); creation
  is blocked until the customer's KYC is approved
- **`ledger-service`** — the financial source of truth: real double-entry postings (every
  amount is a debit somewhere and a credit somewhere else, enforced before any row is
  written), balances computed from journal lines rather than stored as a mutable field,
  reversals that create a new inverted entry rather than editing history. Also the one
  internal-only endpoint (`POST /v1/ledger/transfers`) that other services call via a
  short-lived **SERVICE-role JWT** they mint themselves — never the customer's own token,
  since by the time a saga's async step runs there's no HTTP request to forward it from
- **`fraud-service`** — a simple, explainable rule engine (amount thresholds + velocity)
  over `TransferInitiated`, producing `TransferApproved`/`Flagged`/`Blocked`
- **`transfer-service`** — the saga orchestrator: `TransferInitiated` → fraud check → daily
  limit check → synchronous ledger posting → `TransferCompleted`/`Failed`. Idempotency-Key
  required; same key always returns the same transfer, never a duplicate
- **`notification-service`** — a pure Kafka consumer behind a provider adapter
  (`MockNotificationProvider`), never blocks the transaction that triggered it
- **`payment-service`** — inbound/outbound payments (money crossing the bank boundary),
  resolved synchronously against a mock provider, same idempotency guarantee as transfers
- **`card-service`** — card issuance/activation/blocking, plus a webhook endpoint
  (`POST /v1/cards/:id/transactions`) simulating a card network authorization; approved
  spend posts as a ledger withdrawal, same mechanism as an outbound payment
- **`reporting-service`** — read-only reports built entirely from a denormalized,
  event-sourced read-model (customer statements, activity summaries, transfer/failure
  reports) — never a live query against another service's transactional database
  (PRD section 43)

Every service enforces JWT auth + RBAC permissions by default (`@Public()` opts a route
out), and self-vs-staff scoping (a `CUSTOMER` only ever sees their own records; staff
roles — `BANK_ADMIN`/`OPERATIONS`/`COMPLIANCE_OFFICER`/`FINANCE_OFFICER`/
`CUSTOMER_SUPPORT`/`SUPER_ADMIN` — see any record in their tenant). Retry + Dead Letter
Queue (PRD section 22) on every consumer.

Shared packages: `shared` (tenant context, roles/permissions, domain errors), `config`
(env validation), `events` (Kafka producer/consumer, outbox publisher, DLQ helper, topic
auto-provisioning), `auth` (JWT guard, global auth guard, permissions/roles guards, tenant
middleware, service-token minting), `observability` (OpenTelemetry tracing, logger).
Local infra: Postgres, Redis, Kafka (KRaft, single broker) via Docker Compose.

**Deliberately out of scope for this cut** (see each report/section in the PRD for what a
later pass would add): fee schedules, settlement batches, reconciliation jobs, real
external provider integrations (every provider adapter here is a mock), and a UI.

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable pnpm`)
- Docker Desktop (for Postgres/Redis/Kafka)

## Getting started

```bash
cp .env.example .env
pnpm install

# start Postgres, Redis, Kafka
pnpm infra:up

# apply migrations for every service
for svc in identity customer kyc account ledger fraud transfer notification payment card reporting; do
  pnpm --filter $svc-service exec prisma migrate dev --name init
done

# run all 12 backend services at once, labeled and color-coded in one terminal
pnpm dev

# ...or the backend plus the Angular customer-portal together
pnpm dev:all

# ...or just the ones you need for what you're testing, one terminal each
pnpm dev:identity-service
pnpm dev:customer-service
pnpm dev:kyc-service
pnpm dev:account-service
pnpm dev:ledger-service
pnpm dev:fraud-service
pnpm dev:transfer-service
pnpm dev:notification-service
pnpm dev:payment-service
pnpm dev:card-service
pnpm dev:reporting-service
pnpm dev:api-gateway

# customer-facing Angular app on its own (talks to the gateway at localhost:3000)
pnpm dev:customer-portal
```

`pnpm dev` runs every backend service in a single terminal via `concurrently`, each prefixed with its
service name and given its own color — `Ctrl+C` once stops all of them. It expects infra to already
be up and migrations already applied (the steps above it).

## API docs

Each service publishes its own Swagger UI (not proxied through the gateway — swagger-ui's
asset links break once nested under a different path prefix):

| Service | Port | Docs |
|---|---|---|
| api-gateway | 3000 | — (routes to the others; see below) |
| identity-service | 3001 | http://localhost:3001/docs |
| customer-service | 3002 | http://localhost:3002/docs |
| kyc-service | 3003 | http://localhost:3003/docs |
| account-service | 3004 | http://localhost:3004/docs |
| ledger-service | 3005 | http://localhost:3005/docs |
| fraud-service | 3006 | http://localhost:3006/docs |
| transfer-service | 3007 | http://localhost:3007/docs |
| notification-service | 3008 | http://localhost:3008/docs |
| payment-service | 3009 | http://localhost:3009/docs |
| card-service | 3010 | http://localhost:3010/docs |
| reporting-service | 3011 | http://localhost:3011/docs |

## Try it

All customer/staff-facing requests go through the gateway at `http://localhost:3000`.
The full walkthrough, in order:

```bash
# 1. tenant, register, login
curl -s -X POST http://localhost:3000/v1/tenants -H 'Content-Type: application/json' -d '{"name":"Acme Bank"}'
curl -s -X POST http://localhost:3000/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"tenantId":"<tenant-id>","email":"jane@example.com","password":"correct-horse-battery"}'
curl -s -X POST http://localhost:3000/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"correct-horse-battery"}'
# tenantId is optional on login — omitted here, it searches every tenant for a matching
# email + password (a `tenantId_email` pair is only unique per-tenant, so pass it explicitly
# if you ever need to disambiguate the same email existing in two tenants with the same password)

# 2. KYC (mock provider auto-approves)
curl -s -X POST http://localhost:3000/v1/kyc/verifications -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' -d '{"customerId":"<user-id>"}'

# 3. account (blocked until step 2 clears)
curl -s -X POST http://localhost:3000/v1/accounts -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' -d '{"customerId":"<user-id>","type":"CURRENT","currency":"USD"}'

# activation needs a staff role — there's no self-service way to get one, by design:
# UPDATE users SET roles = ARRAY['FINANCE_OFFICER'] WHERE id = '<user-id>';   (then log in again)
curl -s -X POST http://localhost:3000/v1/accounts/<account-id>/activate -H 'Authorization: Bearer <staffToken>'

# 4. fund it — an inbound payment (or a staff-only ledger deposit)
curl -s -X POST http://localhost:3000/v1/payments -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: pay-1' \
  -d '{"accountId":"<account-id>","direction":"INBOUND","amount":50000,"currency":"USD"}'

# 5. issue and activate a card, then simulate spend
curl -s -X POST http://localhost:3000/v1/cards -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' -d '{"accountId":"<account-id>","type":"VIRTUAL"}'
curl -s -X POST http://localhost:3000/v1/cards/<card-id>/activate -H 'Authorization: Bearer <token>'
curl -s -X POST http://localhost:3000/v1/cards/<card-id>/transactions \
  -H 'Content-Type: application/json' -d '{"amount":499,"currency":"USD","merchantName":"Coffee Shop"}'

# 6. transfer to another customer (repeat steps 1-3 for them first)
curl -s -X POST http://localhost:3000/v1/transfers -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: transfer-1' \
  -d '{"sourceAccountId":"<account-id>","destinationAccountId":"<their-account-id>","amount":2000,"currency":"USD"}'
# -> returns PENDING immediately; poll GET /v1/transfers/<id> for the final status

# 7. see it all show up
curl -s http://localhost:3000/v1/ledger/accounts/<account-id>/balance -H 'Authorization: Bearer <token>'
curl -s http://localhost:3000/v1/reports/customers/<user-id>/statement -H 'Authorization: Bearer <token>'
curl -s http://localhost:3000/v1/notifications -H 'Authorization: Bearer <token>'
```

Amounts are always minor units (cents). Money-moving writes (`/v1/transfers`,
`/v1/payments`) require an `Idempotency-Key` header. Staff-only actions need the right
permission (`ledger:post`, `account:activate`, `transaction:reverse`, etc.) — see
`packages/shared/src/roles/roles.ts` for the full role → permission map.

### Platform administration (SUPER_ADMIN)

`SUPER_ADMIN` is a cross-tenant role — it's the only role granted `tenant:read`, which
gates two identity-service endpoints:

```bash
# list every tenant on the platform
curl -s http://localhost:3000/v1/tenants -H 'Authorization: Bearer <superAdminToken>'

# list the users belonging to one tenant (passwordHash is never returned)
curl -s http://localhost:3000/v1/tenants/<tenant-id>/users -H 'Authorization: Bearer <superAdminToken>'
```

There's no self-service way to become a `SUPER_ADMIN` (by design, same as any staff
role) — grant it directly in the database:
```sql
UPDATE users SET roles = ARRAY['SUPER_ADMIN'] WHERE id = '<user-id>';   -- then log in again
```

`POST /v1/tenants` (creating a tenant) stays `@Public()` and unauthenticated — a brand
new bank has no users yet to log in as, so tenant creation has to work before any
account (including a `SUPER_ADMIN` one) exists. A logged-in `SUPER_ADMIN` can still call
the same endpoint; it just isn't gated behind a permission.

## Frontend

`apps/customer-portal` is an Angular 19 single-page app covering the full customer
journey — register/login, profile & KYC, accounts, transfers, cards, payments,
statements, and notifications — talking to the gateway only (`http://localhost:3000`).
Staff-only actions (activate/freeze an account, etc.) render conditionally based on the
permissions embedded in the logged-in user's JWT, so a plain customer never sees them.

```bash
pnpm dev:customer-portal   # http://localhost:4200
```

## Repository layout

See PRD section 35 (Node.js Project Structure). `apps/` holds one deployable NestJS
service per bounded context plus the `customer-portal` Angular app; `packages/` holds
code shared across services; `infrastructure/` holds local dev infra (Docker Compose,
Postgres init scripts).

## What's next

The platform covers PRD sections 36's full phase list end to end. Natural next steps
would be: fee schedules and daily settlement/reconciliation jobs (PRD section 42–43),
real provider integrations behind the existing mock adapters, a saga/limit-service split
out of transfer-service as volume grows, and a UI.
