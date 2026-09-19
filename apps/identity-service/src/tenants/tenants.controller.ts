import { Controller, Get, Param, Post, Body } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public, RequirePermissions } from "@digital-banking/auth";
import { Permission, TenantContextStore } from "@digital-banking/shared";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "../auth/dto/create-tenant.dto";
import { CreateTenantAdminDto } from "./dto/create-tenant-admin.dto";

@ApiTags("tenants")
@Controller("v1/tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // Left public: this is also how a brand-new bank bootstraps itself before
  // any user (let alone a SUPER_ADMIN) exists to log in — see PRD section 27.
  @ApiOperation({ summary: "Create a tenant (local/dev bootstrap, or platform admin)" })
  @Public()
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto.name);
  }

  @ApiOperation({ summary: "List every tenant on the platform (SUPER_ADMIN only)" })
  @ApiBearerAuth("access-token")
  @RequirePermissions(Permission.TENANT_READ)
  @Get()
  listAll() {
    return this.tenantsService.listAll();
  }

  @ApiOperation({ summary: "Get a single tenant by id (SUPER_ADMIN only)" })
  @ApiBearerAuth("access-token")
  @RequirePermissions(Permission.TENANT_READ)
  @Get(":id")
  get(@Param("id") id: string) {
    return this.tenantsService.get(id);
  }

  @ApiOperation({ summary: "List the users belonging to a tenant (SUPER_ADMIN only)" })
  @ApiBearerAuth("access-token")
  @RequirePermissions(Permission.TENANT_READ)
  @Get(":id/users")
  listUsers(@Param("id") id: string) {
    return this.tenantsService.listUsers(id);
  }

  @ApiOperation({ summary: "Create a tenant admin who can log in directly (SUPER_ADMIN only)" })
  @ApiBearerAuth("access-token")
  @RequirePermissions(Permission.TENANT_MANAGE)
  @Post(":id/admins")
  createAdmin(@Param("id") id: string, @Body() dto: CreateTenantAdminDto) {
    const { correlationId } = TenantContextStore.getOrThrow();
    return this.tenantsService.createAdmin(id, dto.email, dto.password, correlationId);
  }
}
