import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { ConflictDomainError, NotFoundDomainError } from "@digital-banking/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.tenant.create({ data: { name } });
  }

  listAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
  }

  get(tenantId: string) {
    return this.requireTenant(tenantId);
  }

  async listUsers(tenantId: string) {
    await this.requireTenant(tenantId);

    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        email: true,
        roles: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Provisions a staff account directly — deliberately skips the
  // UserRegistered domain event (unlike self-service register()), since
  // customer-service treats every UserRegistered as a banking customer and
  // would create a bogus Customer/KYC row for a tenant admin.
  async createAdmin(tenantId: string, email: string, password: string, correlationId: string) {
    await this.requireTenant(tenantId);

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new ConflictDomainError(`User ${email} already exists for this tenant`);
    }

    const passwordHash = await argon2.hash(password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { tenantId, email, passwordHash, roles: ["BANK_ADMIN"] },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: created.id,
          action: "TENANT_ADMIN_CREATED",
          resource: `user:${created.id}`,
          result: "SUCCESS",
          correlationId,
        },
      });

      return created;
    });

    return { id: user.id, tenantId: user.tenantId, email: user.email, roles: user.roles };
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundDomainError("Tenant", tenantId);
    }
    return tenant;
  }
}
