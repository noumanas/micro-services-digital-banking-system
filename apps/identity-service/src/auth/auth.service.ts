import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { Prisma } from "../../generated/prisma-client";
import { ConflictDomainError, UnauthorizedDomainError } from "@digital-banking/shared";
import { createDomainEvent } from "@digital-banking/events";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, correlationId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
    });
    if (existing) {
      throw new ConflictDomainError(`User ${dto.email} already exists for this tenant`);
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: dto.tenantId,
          email: dto.email,
          passwordHash,
          roles: ["CUSTOMER"],
        },
      });

      // Business row + outbox row committed atomically — PRD section 20.
      const event = createDomainEvent({
        eventType: "UserRegistered",
        tenantId: created.tenantId,
        correlationId,
        producer: "identity-service",
        aggregateType: "user",
        aggregateId: created.id,
        data: { userId: created.id, email: created.email },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: created.tenantId,
          eventType: event.eventType,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: created.tenantId,
          actorUserId: created.id,
          action: "USER_REGISTERED",
          resource: `user:${created.id}`,
          result: "SUCCESS",
          correlationId,
        },
      });

      return created;
    });

    return { id: user.id, tenantId: user.tenantId, email: user.email, roles: user.roles };
  }

  async login(dto: LoginDto, correlationId: string) {
    const user = dto.tenantId
      ? await this.prisma.user.findUnique({
          where: { tenantId_email: { tenantId: dto.tenantId, email: dto.email } },
        })
      : await this.findByEmailAndPassword(dto.email, dto.password);

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedDomainError("Invalid credentials");
    }

    // findByEmailAndPassword already verified the password when tenantId
    // was omitted — verifying again here is harmless (same hash) and keeps
    // this one check as the single source of truth for the tenantId path.
    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedDomainError("Invalid credentials");
    }

    const accessToken = this.tokens.signAccessToken({
      id: user.id,
      tenantId: user.tenantId,
      roles: user.roles,
    });
    const refresh = this.tokens.generateRefreshToken();

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
        },
      });

      const event = createDomainEvent({
        eventType: "UserAuthenticated",
        tenantId: user.tenantId,
        correlationId,
        producer: "identity-service",
        aggregateType: "user",
        aggregateId: user.id,
        data: { userId: user.id },
      });

      await tx.outboxEvent.create({
        data: {
          tenantId: user.tenantId,
          eventType: event.eventType,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: "USER_LOGIN",
          resource: `user:${user.id}`,
          result: "SUCCESS",
          correlationId,
        },
      });
    });

    return { accessToken, refreshToken: refresh.token };
  }

  // Email is only unique per-tenant (@@unique([tenantId, email])), so
  // logging in without a tenantId means checking every tenant's record for
  // this email against the given password, and using whichever one (if any)
  // actually matches — never guessing which tenant the caller meant.
  private async findByEmailAndPassword(email: string, password: string) {
    const candidates = await this.prisma.user.findMany({ where: { email } });
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.passwordHash, password)) {
        return candidate;
      }
    }
    return null;
  }

  async refresh(dto: RefreshDto) {
    const tokenHash = this.tokens.hashToken(dto.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedDomainError("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedDomainError("Invalid or expired refresh token");
    }

    const newRefresh = this.tokens.generateRefreshToken();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          tokenHash: newRefresh.tokenHash,
          expiresAt: newRefresh.expiresAt,
        },
      }),
    ]);

    const accessToken = this.tokens.signAccessToken({
      id: user.id,
      tenantId: user.tenantId,
      roles: user.roles,
    });

    return { accessToken, refreshToken: newRefresh.token };
  }

  async logout(dto: RefreshDto) {
    const tokenHash = this.tokens.hashToken(dto.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
