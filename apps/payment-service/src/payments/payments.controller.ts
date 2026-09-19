import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { DomainError, Permission, TenantContextStore } from "@digital-banking/shared";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@ApiTags("payments")
@ApiBearerAuth("access-token")
@Controller("v1/payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: "Initiate a payment (INBOUND or OUTBOUND)",
    description: "Resolves synchronously against the configured provider adapter and posts to the ledger.",
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new DomainError("Idempotency-Key header is required", "BAD_REQUEST", 400);
    }
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.paymentsService.create(user, dto, idempotencyKey, correlationId);
  }

  @ApiOperation({ summary: "List payments (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.PAYMENT_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.paymentsService.list(user, customerId);
  }

  @ApiOperation({ summary: "Get a payment's status" })
  @RequirePermissions(Permission.PAYMENT_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.paymentsService.findById(user, id);
  }

  @ApiOperation({ summary: "Reverse a completed payment", description: "Staff only." })
  @RequirePermissions(Permission.TRANSACTION_REVERSE)
  @Post(":id/reverse")
  reverse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.paymentsService.reverse(user, id, correlationId);
  }
}
