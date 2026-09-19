import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma-client";
import { createDomainEvent } from "@digital-banking/events";
import { ConflictDomainError, ForbiddenDomainError, NotFoundDomainError, STAFF_ROLES } from "@digital-banking/shared";
import { AuthenticatedUser } from "@digital-banking/auth";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { CreateInternalTransferDto } from "./dto/create-internal-transfer.dto";

const EXTERNAL_FUNDING_CODE = "EXTERNAL_FUNDING";

function assertCanAccess(user: AuthenticatedUser, customerId: string | null): void {
  const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
  if (!isStaff && customerId !== user.userId) {
    throw new ForbiddenDomainError("Cannot access another customer's ledger records");
  }
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // Deliberately outside any transaction: the system account is a
  // find-or-create side effect, not a financial posting itself.
  private async getOrCreateExternalFundingAccount(tenantId: string, currency: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { tenantId, code: EXTERNAL_FUNDING_CODE, currency },
    });
    if (existing) return existing;

    return this.prisma.ledgerAccount.create({
      data: { tenantId, code: EXTERNAL_FUNDING_CODE, currency },
    });
  }

  private async getLedgerAccountFor(tenantId: string, externalAccountId: string) {
    const ledgerAccount = await this.prisma.ledgerAccount.findFirst({
      where: { tenantId, externalAccountId },
    });
    if (!ledgerAccount) {
      throw new NotFoundDomainError("LedgerAccount", externalAccountId);
    }
    return ledgerAccount;
  }

  // Consumes account-service's AccountCreated — the ledger account exists
  // the moment the real account does, never created lazily on first posting
  // (PRD section 45, principle 3: decouple via events, not live calls).
  async handleAccountCreated(input: {
    tenantId: string;
    accountId: string;
    customerId: string;
    currency: string;
  }): Promise<void> {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { externalAccountId: input.accountId },
    });
    if (existing) return; // idempotent replay

    await this.prisma.ledgerAccount.create({
      data: {
        tenantId: input.tenantId,
        externalAccountId: input.accountId,
        customerId: input.customerId,
        currency: input.currency,
      },
    });
  }

  // Money entering the bank from outside (initial funding, cash deposit,
  // incoming wire) — modeled as a real double-entry posting against a
  // per-tenant, per-currency system account, never a bare balance update
  // (PRD section 10, core principle).
  async deposit(user: AuthenticatedUser, accountId: string, dto: CreateDepositDto, correlationId: string) {
    const target = await this.getLedgerAccountFor(user.tenantId, accountId);
    if (target.currency !== dto.currency) {
      throw new ConflictDomainError(
        `Account ${accountId} is denominated in ${target.currency}, not ${dto.currency}`,
      );
    }

    const external = await this.getOrCreateExternalFundingAccount(user.tenantId, dto.currency);

    return this.postEntry(user.tenantId, correlationId, {
      reference: "DEPOSIT",
      description: dto.description,
      lines: [
        { ledgerAccountId: external.id, direction: "DEBIT", amount: dto.amount, currency: dto.currency },
        { ledgerAccountId: target.id, direction: "CREDIT", amount: dto.amount, currency: dto.currency },
      ],
      eventType: "JournalEntryPosted",
      eventData: { accountId, amount: dto.amount, currency: dto.currency, direction: "CREDIT" },
    });
  }

  // The symmetric case: money leaving the bank to somewhere external (an
  // outbound payment, an ATM withdrawal). Same system contra-account as
  // deposit(), opposite direction, and — unlike a deposit — subject to a
  // balance check since the bank can't credit money it doesn't have.
  async withdraw(user: AuthenticatedUser, accountId: string, dto: CreateDepositDto, correlationId: string) {
    const source = await this.getLedgerAccountFor(user.tenantId, accountId);
    if (source.currency !== dto.currency) {
      throw new ConflictDomainError(
        `Account ${accountId} is denominated in ${source.currency}, not ${dto.currency}`,
      );
    }

    const balance = await this.computeBalance(source.id);
    if (balance < dto.amount) {
      throw new ConflictDomainError(`Account ${accountId} has insufficient funds`);
    }

    const external = await this.getOrCreateExternalFundingAccount(user.tenantId, dto.currency);

    return this.postEntry(user.tenantId, correlationId, {
      reference: "WITHDRAWAL",
      description: dto.description,
      lines: [
        { ledgerAccountId: source.id, direction: "DEBIT", amount: dto.amount, currency: dto.currency },
        { ledgerAccountId: external.id, direction: "CREDIT", amount: dto.amount, currency: dto.currency },
      ],
      eventType: "JournalEntryPosted",
      eventData: { accountId, amount: dto.amount, currency: dto.currency, direction: "DEBIT" },
    });
  }

  async reverse(user: AuthenticatedUser, journalEntryId: string, correlationId: string) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id: journalEntryId, tenantId: user.tenantId },
      include: { lines: true, reversedBy: true },
    });
    if (!original) {
      throw new NotFoundDomainError("JournalEntry", journalEntryId);
    }
    if (original.reversedBy) {
      throw new ConflictDomainError(`Journal entry ${journalEntryId} has already been reversed`);
    }
    if (original.reversalOfId) {
      throw new ConflictDomainError("Cannot reverse a reversal");
    }

    return this.postEntry(user.tenantId, correlationId, {
      reference: "REVERSAL",
      description: `Reversal of ${journalEntryId}`,
      reversalOfId: original.id,
      lines: original.lines.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        direction: line.direction === "DEBIT" ? "CREDIT" : "DEBIT",
        amount: line.amount,
        currency: line.currency,
      })),
      eventType: "JournalEntryReversed",
      eventData: { originalEntryId: original.id },
    });
  }

  private async postEntry(
    tenantId: string,
    correlationId: string,
    input: {
      reference: string;
      description?: string;
      reversalOfId?: string;
      lines: Array<{ ledgerAccountId: string; direction: "DEBIT" | "CREDIT"; amount: number; currency: string }>;
      eventType: string;
      eventData: Record<string, unknown>;
    },
  ) {
    const debits = input.lines.filter((l) => l.direction === "DEBIT").reduce((sum, l) => sum + l.amount, 0);
    const credits = input.lines.filter((l) => l.direction === "CREDIT").reduce((sum, l) => sum + l.amount, 0);
    if (debits !== credits) {
      // A programming-error guard, not a user-facing validation: every
      // caller in this service constructs balanced lines by construction.
      throw new ConflictDomainError("Journal entry debits and credits do not balance");
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          reference: input.reference,
          description: input.description,
          correlationId,
          reversalOfId: input.reversalOfId,
          lines: { create: input.lines },
        },
        include: { lines: true },
      });

      const event = createDomainEvent({
        eventType: input.eventType,
        tenantId,
        correlationId,
        producer: "ledger-service",
        aggregateType: "journal-entry",
        aggregateId: entry.id,
        data: { journalEntryId: entry.id, ...input.eventData },
      });

      await tx.outboxEvent.create({
        data: { tenantId, eventType: event.eventType, payload: event as unknown as Prisma.InputJsonValue },
      });

      return entry;
    });
  }

  private async computeBalance(ledgerAccountId: string): Promise<number> {
    const [credits, debits] = await Promise.all([
      this.prisma.journalLine.aggregate({
        where: { ledgerAccountId, direction: "CREDIT" },
        _sum: { amount: true },
      }),
      this.prisma.journalLine.aggregate({
        where: { ledgerAccountId, direction: "DEBIT" },
        _sum: { amount: true },
      }),
    ]);
    return (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
  }

  async getBalance(user: AuthenticatedUser, accountId: string) {
    const account = await this.getLedgerAccountFor(user.tenantId, accountId);
    assertCanAccess(user, account.customerId);

    const balance = await this.computeBalance(account.id);
    return { accountId, currency: account.currency, balance };
  }

  // Called by transfer-service (never a customer directly) mid-saga, once
  // fraud checks and limits have already cleared — this endpoint trusts its
  // caller's SERVICE identity and does not re-check ownership (PRD section
  // 30: ledger posting requires strong consistency, so this is a
  // synchronous call, not a fire-and-forget event).
  async transfer(tenantId: string, dto: CreateInternalTransferDto, correlationId: string) {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new ConflictDomainError("Source and destination accounts must differ");
    }

    const source = await this.getLedgerAccountFor(tenantId, dto.sourceAccountId);
    const destination = await this.getLedgerAccountFor(tenantId, dto.destinationAccountId);

    if (source.currency !== dto.currency || destination.currency !== dto.currency) {
      throw new ConflictDomainError(
        `Currency mismatch: source is ${source.currency}, destination is ${destination.currency}, requested ${dto.currency}`,
      );
    }

    const sourceBalance = await this.computeBalance(source.id);
    if (sourceBalance < dto.amount) {
      throw new ConflictDomainError(`Account ${dto.sourceAccountId} has insufficient funds`);
    }

    return this.postEntry(tenantId, correlationId, {
      reference: "TRANSFER",
      description: dto.description,
      lines: [
        { ledgerAccountId: source.id, direction: "DEBIT", amount: dto.amount, currency: dto.currency },
        { ledgerAccountId: destination.id, direction: "CREDIT", amount: dto.amount, currency: dto.currency },
      ],
      eventType: "LedgerTransferPosted",
      eventData: {
        sourceAccountId: dto.sourceAccountId,
        destinationAccountId: dto.destinationAccountId,
        amount: dto.amount,
        currency: dto.currency,
      },
    });
  }

  async getEntries(user: AuthenticatedUser, accountId: string) {
    const account = await this.getLedgerAccountFor(user.tenantId, accountId);
    assertCanAccess(user, account.customerId);

    const lines = await this.prisma.journalLine.findMany({
      where: { ledgerAccountId: account.id },
      include: { journalEntry: true },
      orderBy: { createdAt: "desc" },
    });

    // For transfers, resolve the other leg's owning customer so the UI can
    // show "who" rather than just "what" — both legs share a journalEntryId,
    // so the counterparty is whichever line of that entry isn't this account.
    const transferEntryIds = lines
      .filter((line) => line.journalEntry.reference === "TRANSFER")
      .map((line) => line.journalEntryId);

    const counterpartyLines = transferEntryIds.length
      ? await this.prisma.journalLine.findMany({
          where: { journalEntryId: { in: transferEntryIds }, ledgerAccountId: { not: account.id } },
          include: { ledgerAccount: true },
        })
      : [];
    const counterpartyByEntryId = new Map(
      counterpartyLines.map((line) => [line.journalEntryId, line.ledgerAccount.customerId]),
    );

    return lines.map((line) => ({
      journalEntryId: line.journalEntryId,
      direction: line.direction,
      amount: line.amount,
      currency: line.currency,
      reference: line.journalEntry.reference,
      description: line.journalEntry.description,
      counterpartyCustomerId: counterpartyByEntryId.get(line.journalEntryId) ?? null,
      createdAt: line.createdAt,
    }));
  }

  async getEntry(user: AuthenticatedUser, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { lines: { include: { ledgerAccount: true } } },
    });
    if (!entry) {
      throw new NotFoundDomainError("JournalEntry", id);
    }

    const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
    const touchesSelf = entry.lines.some((line) => line.ledgerAccount.customerId === user.userId);
    if (!isStaff && !touchesSelf) {
      throw new ForbiddenDomainError("Cannot access another customer's ledger records");
    }

    return entry;
  }
}
