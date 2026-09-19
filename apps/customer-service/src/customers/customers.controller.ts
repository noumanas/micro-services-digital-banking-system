import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions, RequireRoles } from "@digital-banking/auth";
import { Permission, Role, TenantContextStore } from "@digital-banking/shared";
import { CustomersService } from "./customers.service";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@ApiTags("customers")
@ApiBearerAuth("access-token")
@Controller("v1/customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: "List customers for the caller's tenant (staff only)" })
  @RequirePermissions(Permission.CUSTOMER_READ)
  @RequireRoles(Role.SUPER_ADMIN, Role.BANK_ADMIN, Role.OPERATIONS, Role.COMPLIANCE_OFFICER, Role.CUSTOMER_SUPPORT)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.list(user.tenantId);
  }

  @ApiOperation({ summary: "List customers for any tenant (SUPER_ADMIN only, platform administration)" })
  @RequirePermissions(Permission.TENANT_READ)
  @Get("tenants/:tenantId")
  listByTenant(@Param("tenantId") tenantId: string) {
    return this.customersService.list(tenantId);
  }

  @ApiOperation({
    summary: "Get a customer's display name only (any authenticated user in the same tenant)",
    description:
      "Deliberately narrow — just enough to show 'who' on a shared transaction (e.g. a transfer " +
      "counterparty) without exposing the full profile that get() requires self-or-staff access for.",
  })
  @RequirePermissions(Permission.CUSTOMER_READ)
  @Get(":id/display-name")
  getDisplayName(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.customersService.findDisplayName(user.tenantId, id);
  }

  @ApiOperation({ summary: "Get a customer profile (self, or staff for any customer in-tenant)" })
  @RequirePermissions(Permission.CUSTOMER_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.customersService.findById(user, id);
  }

  @ApiOperation({ summary: "Update a customer profile" })
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.customersService.update(user, id, dto, correlationId);
  }
}
