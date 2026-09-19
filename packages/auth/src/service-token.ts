import { JwtService } from "@nestjs/jwt";
import { Permission, Role } from "@digital-banking/shared";
import { AccessTokenPayload } from "./types";

// Mints a short-lived SERVICE-role token for one service to call another
// mid-saga (e.g. transfer-service posting to ledger-service after fraud/limit
// checks clear). Verified by the exact same JwtStrategy/GlobalAuthGuard as a
// customer token — the callee never needs to know the difference — but
// SERVICE is never issued via /v1/auth/login and carries only the specific
// permissions the caller needs for that one call.
export function signServiceToken(
  accessSecret: string,
  input: { producer: string; tenantId: string; permissions: Permission[] },
): string {
  const payload: AccessTokenPayload = {
    sub: input.producer,
    tenantId: input.tenantId,
    roles: [Role.SERVICE],
    permissions: input.permissions,
  };
  return new JwtService({ secret: accessSecret }).sign(payload, { expiresIn: "60s" });
}
