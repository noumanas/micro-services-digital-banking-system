import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, Public, RequirePermissions } from "@digital-banking/auth";
import { Permission, TenantContextStore } from "@digital-banking/shared";
import { CardsService } from "./cards.service";
import { IssueCardDto } from "./dto/issue-card.dto";
import { CardTransactionDto } from "./dto/card-transaction.dto";

@ApiTags("cards")
@Controller("v1/cards")
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Issue a new card against an account you own" })
  @RequirePermissions(Permission.CARD_ISSUE)
  @Post()
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueCardDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.cardsService.issue(user, dto, correlationId);
  }

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "List cards (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.CARD_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.cardsService.list(user, customerId);
  }

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "List cards for any tenant (SUPER_ADMIN only, platform administration)" })
  @RequirePermissions(Permission.TENANT_READ)
  @Get("tenants/:tenantId")
  listByTenant(@Param("tenantId") tenantId: string) {
    return this.cardsService.listByTenant(tenantId);
  }

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Get a card" })
  @RequirePermissions(Permission.CARD_READ)
  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.cardsService.findById(user, id);
  }

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Activate a pending card" })
  @RequirePermissions(Permission.CARD_ISSUE)
  @Post(":id/activate")
  activate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.cardsService.activate(user, id, correlationId);
  }

  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Block a card (lost, stolen, or suspected fraud) — self-service" })
  @RequirePermissions(Permission.CARD_BLOCK)
  @Post(":id/block")
  block(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.cardsService.block(user, id, correlationId);
  }

  @Public()
  @ApiOperation({
    summary: "Card network webhook: an authorization attempt was made against this card",
    description:
      "Represents the inbound webhook a real card processor would call. Public here for local testing " +
      "only — a production integration must verify the provider's webhook signature instead of trusting " +
      "the caller (PRD section 8/11's provider-adapter principle applies here too).",
  })
  @Post(":cardId/transactions")
  receiveTransaction(@Param("cardId") cardId: string, @Body() dto: CardTransactionDto) {
    const correlationId = TenantContextStore.get()?.correlationId ?? randomUUID();
    return this.cardsService.receiveTransaction(cardId, dto, correlationId);
  }
}
