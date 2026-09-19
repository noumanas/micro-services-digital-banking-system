import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { Permission } from "@digital-banking/shared";
import { FraudService } from "./fraud.service";

@ApiTags("fraud")
@ApiBearerAuth("access-token")
@Controller("v1/fraud/checks")
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @ApiOperation({ summary: "List fraud checks for the tenant (compliance/ops visibility)" })
  @ApiQuery({ name: "flagged", required: false, description: "true to show only FLAGGED/BLOCKED" })
  @RequirePermissions(Permission.FRAUD_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("flagged") flagged?: string) {
    return this.fraudService.list(user, flagged === "true");
  }

  @ApiOperation({ summary: "Get the fraud check for one transfer" })
  @RequirePermissions(Permission.FRAUD_READ)
  @Get(":transferId")
  getByTransfer(@CurrentUser() user: AuthenticatedUser, @Param("transferId") transferId: string) {
    return this.fraudService.findByTransferId(user, transferId);
  }
}
