import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser, RequirePermissions } from "@digital-banking/auth";
import { Permission } from "@digital-banking/shared";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth("access-token")
@Controller("v1/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: "List notifications (staff: any customer in-tenant; customer: own only)" })
  @ApiQuery({ name: "customerId", required: false })
  @RequirePermissions(Permission.NOTIFICATION_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query("customerId") customerId?: string) {
    return this.notificationsService.list(user, customerId);
  }
}
