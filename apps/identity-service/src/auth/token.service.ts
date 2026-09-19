import { randomBytes, createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AccessTokenPayload } from "@digital-banking/auth";
import { DEFAULT_ROLE_PERMISSIONS, Permission, Role } from "@digital-banking/shared";

export interface UserForToken {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  permissionsForRoles(roles: string[]): Permission[] {
    const set = new Set<Permission>();
    for (const role of roles) {
      const perms = DEFAULT_ROLE_PERMISSIONS[role as Role] ?? [];
      perms.forEach((p) => set.add(p));
    }
    return Array.from(set);
  }

  signAccessToken(user: UserForToken): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      roles: user.roles as Role[],
      permissions: this.permissionsForRoles(user.roles),
    };

    return this.jwt.sign(payload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
    });
  }

  generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(48).toString("hex");
    const tokenHash = this.hashToken(token);
    const ttl = this.config.get<string>("JWT_REFRESH_TTL", "7d");
    const expiresAt = new Date(Date.now() + parseTtlMs(ttl));
    return { token, tokenHash, expiresAt };
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 86_400_000;
  return value * unitMs;
}
