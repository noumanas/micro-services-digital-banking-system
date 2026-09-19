import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions, RequireRoles } from "@digital-banking/auth";
import { Permission, Role } from "@digital-banking/shared";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@ApiBearerAuth("access-token")
@Controller("v1/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: "Account statement — a customer's transaction history (self, or staff for anyone in-tenant)" })
  @ApiQuery({ name: "limit", required: false })
  @RequirePermissions(Permission.REPORTING_READ)
  @Get("customers/:customerId/statement")
  statement(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
  ) {
    return this.reportsService.statement(user, customerId, limit ? Number(limit) : 50);
  }

  @ApiOperation({ summary: "Customer activity summary over a trailing window" })
  @ApiQuery({ name: "days", required: false, description: "Trailing window size, default 30" })
  @RequirePermissions(Permission.REPORTING_READ)
  @Get("customers/:customerId/activity")
  activity(
    @CurrentUser() user: AuthenticatedUser,
    @Param("customerId") customerId: string,
    @Query("days") days?: string,
  ) {
    return this.reportsService.activity(user, customerId, days ? Number(days) : 30);
  }

  @ApiOperation({ summary: "Tenant-wide transfer report, broken down by status (staff only)" })
  @RequirePermissions(Permission.REPORTING_READ)
  @RequireRoles(Role.SUPER_ADMIN, Role.BANK_ADMIN, Role.OPERATIONS, Role.COMPLIANCE_OFFICER, Role.FINANCE_OFFICER)
  @Get("transfers")
  transfers(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.transfersReport(user);
  }

  @ApiOperation({ summary: "Tenant-wide failed transactions across transfers, payments, and card spend (staff only)" })
  @ApiQuery({ name: "limit", required: false })
  @RequirePermissions(Permission.REPORTING_READ)
  @RequireRoles(Role.SUPER_ADMIN, Role.BANK_ADMIN, Role.OPERATIONS, Role.COMPLIANCE_OFFICER, Role.FINANCE_OFFICER)
  @Get("failed-transactions")
  failedTransactions(@CurrentUser() user: AuthenticatedUser, @Query("limit") limit?: string) {
    return this.reportsService.failedTransactions(user, limit ? Number(limit) : 50);
  }
}
