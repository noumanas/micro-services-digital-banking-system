import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { Permission, TenantContextStore } from "@digital-banking/shared";
import { AccountsService } from "./accounts.service";
import { CreateAccountDto } from "./dto/create-account.dto";

@ApiTags("accounts")
@ApiBearerAuth("access-token")
@Controller("v1/accounts")
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOperation({ summary: "Create an account (requires the customer's KYC to be approved)" })
  @RequirePermissions(Permission.ACCOUNT_CREATE)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.accountsService.create(user, dto, correlationId);
  }

  @ApiOperation({ summary: "List accounts (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.ACCOUNT_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.accountsService.list(user, customerId);
  }

  @ApiOperation({ summary: "List accounts for any tenant (SUPER_ADMIN only, platform administration)" })
  @RequirePermissions(Permission.TENANT_READ)
  @Get("tenants/:tenantId")
  listByTenant(@Param("tenantId") tenantId: string) {
    return this.accountsService.listByTenant(tenantId);
  }

  @ApiOperation({ summary: "Get an account by id" })
  @RequirePermissions(Permission.ACCOUNT_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.accountsService.findById(user, id);
  }

  @ApiOperation({ summary: "Activate a pending account" })
  @RequirePermissions(Permission.ACCOUNT_ACTIVATE)
  @Post(":id/activate")
  activate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.accountsService.activate(user, id, correlationId);
  }

  @ApiOperation({ summary: "Freeze an active account" })
  @RequirePermissions(Permission.ACCOUNT_FREEZE)
  @Post(":id/freeze")
  freeze(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.accountsService.freeze(user, id, correlationId);
  }

  @ApiOperation({ summary: "Unfreeze a frozen account" })
  @RequirePermissions(Permission.ACCOUNT_UNFREEZE)
  @Post(":id/unfreeze")
  unfreeze(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.accountsService.unfreeze(user, id, correlationId);
  }

  @ApiOperation({ summary: "Close an account" })
  @RequirePermissions(Permission.ACCOUNT_CLOSE)
  @Post(":id/close")
  close(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.accountsService.close(user, id, correlationId);
  }
}
