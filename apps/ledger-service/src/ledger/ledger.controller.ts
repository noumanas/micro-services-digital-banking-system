import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { Permission, TenantContextStore } from "@digital-banking/shared";
import { LedgerService } from "./ledger.service";
import { CreateDepositDto } from "./dto/create-deposit.dto";
import { CreateInternalTransferDto } from "./dto/create-internal-transfer.dto";

@ApiTags("ledger")
@ApiBearerAuth("access-token")
@Controller("v1/ledger")
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({
    summary: "Post a deposit into an account",
    description:
      "Models money entering the bank from outside (initial funding, cash deposit, incoming wire) as a " +
      "real double-entry posting against a system funding account. Staff only.",
  })
  @RequirePermissions(Permission.LEDGER_POST)
  @Post("accounts/:accountId/deposits")
  deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId") accountId: string,
    @Body() dto: CreateDepositDto,
  ) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.ledgerService.deposit(user, accountId, dto, correlationId);
  }

  @ApiOperation({
    summary: "Post a withdrawal out of an account",
    description:
      "The symmetric case to deposit — money leaving the bank to somewhere external. Fails with 409 if " +
      "the account doesn't have sufficient funds. Staff/service only.",
  })
  @RequirePermissions(Permission.LEDGER_POST)
  @Post("accounts/:accountId/withdrawals")
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param("accountId") accountId: string,
    @Body() dto: CreateDepositDto,
  ) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.ledgerService.withdraw(user, accountId, dto, correlationId);
  }

  @ApiOperation({
    summary: "Post an internal transfer between two accounts",
    description:
      "Internal, service-to-service only — called by transfer-service mid-saga after fraud/limit checks " +
      "clear. Never called directly by a customer or exposed through the gateway's customer-facing flows.",
  })
  @RequirePermissions(Permission.LEDGER_TRANSFER)
  @Post("transfers")
  transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInternalTransferDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.ledgerService.transfer(user.tenantId, dto, correlationId);
  }

  @ApiOperation({ summary: "Get an account's current balance" })
  @RequirePermissions(Permission.TRANSACTION_READ)
  @Get("accounts/:accountId/balance")
  getBalance(@CurrentUser() user: AuthenticatedUser, @Param("accountId") accountId: string) {
    return this.ledgerService.getBalance(user, accountId);
  }

  @ApiOperation({ summary: "Get an account's transaction history" })
  @RequirePermissions(Permission.TRANSACTION_READ)
  @Get("accounts/:accountId/entries")
  getEntries(@CurrentUser() user: AuthenticatedUser, @Param("accountId") accountId: string) {
    return this.ledgerService.getEntries(user, accountId);
  }

  @ApiOperation({ summary: "Get a single journal entry with its lines" })
  @RequirePermissions(Permission.TRANSACTION_READ)
  @Get("entries/:id")
  getEntry(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.ledgerService.getEntry(user, id);
  }

  @ApiOperation({
    summary: "Reverse a journal entry",
    description: "Creates a new, inverted entry rather than editing history. Staff only.",
  })
  @RequirePermissions(Permission.TRANSACTION_REVERSE)
  @Post("entries/:id/reverse")
  reverse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.ledgerService.reverse(user, id, correlationId);
  }
}
