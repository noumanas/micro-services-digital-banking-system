import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { DomainError, Permission, TenantContextStore } from "@digital-banking/shared";
import { TransfersService } from "./transfers.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";

@ApiTags("transfers")
@ApiBearerAuth("access-token")
@Controller("v1/transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @ApiOperation({
    summary: "Initiate an internal transfer",
    description:
      "Returns immediately with status PENDING — fraud checks, limit checks, and the ledger posting all " +
      "happen asynchronously. Poll GET /v1/transfers/:id for the final status (PRD section 31, Saga Pattern).",
  })
  @ApiHeader({ name: "Idempotency-Key", required: true, description: "Same key + same tenant = same result, never a duplicate transfer" })
  @RequirePermissions(Permission.TRANSFER_CREATE)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new DomainError("Idempotency-Key header is required", "BAD_REQUEST", 400);
    }
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.transfersService.create(user, dto, idempotencyKey, correlationId);
  }

  @ApiOperation({ summary: "List transfers (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.TRANSACTION_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.transfersService.list(user, customerId);
  }

  @ApiOperation({ summary: "Get a transfer's current status" })
  @RequirePermissions(Permission.TRANSACTION_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.transfersService.findById(user, id);
  }

  @ApiOperation({ summary: "Cancel a still-pending transfer" })
  @RequirePermissions(Permission.TRANSFER_CANCEL)
  @Post(":id/cancel")
  cancel(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.transfersService.cancel(user, id, correlationId);
  }
}
