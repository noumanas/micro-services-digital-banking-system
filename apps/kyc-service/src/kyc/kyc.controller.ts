import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { Permission, TenantContextStore } from "@digital-banking/shared";
import { KycService } from "./kyc.service";
import { CreateVerificationDto } from "./dto/create-verification.dto";

@ApiTags("kyc")
@ApiBearerAuth("access-token")
@Controller("v1/kyc/verifications")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiOperation({
    summary: "Submit a KYC verification request",
    description:
      "Runs synchronously against the configured provider adapter (mock provider locally) and " +
      "returns the final decision. Emits KycVerificationRequested then KycApproved/KycRejected.",
  })
  @RequirePermissions(Permission.KYC_SUBMIT)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVerificationDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.kycService.create(user, dto, correlationId);
  }

  @ApiOperation({ summary: "Get a KYC verification by id" })
  @RequirePermissions(Permission.KYC_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.kycService.findById(user, id);
  }

  @ApiOperation({ summary: "List KYC verifications (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.KYC_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.kycService.list(user, customerId);
  }
}
