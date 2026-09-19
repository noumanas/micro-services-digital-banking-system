import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TokenService } from "./token.service";
import { Role, Permission } from "@digital-banking/shared";

describe("TokenService", () => {
  const config = new ConfigService({
    JWT_ACCESS_SECRET: "test-secret-value",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
  });
  const service = new TokenService(new JwtService(), config);

  it("derives permissions from roles without duplicates", () => {
    const permissions = service.permissionsForRoles([Role.CUSTOMER, Role.API_CLIENT]);
    expect(permissions).toContain(Permission.TRANSFER_CREATE);
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  it("signs an access token containing the tenant and roles", () => {
    const token = service.signAccessToken({ id: "user-1", tenantId: "tenant-1", roles: [Role.CUSTOMER] });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("generates a refresh token whose hash is deterministic", () => {
    const { token, tokenHash } = service.generateRefreshToken();
    expect(service.hashToken(token)).toBe(tokenHash);
  });
});
