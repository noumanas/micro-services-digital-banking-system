import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ForbiddenDomainError, Permission } from "@digital-banking/shared";
import { AuthenticatedUser } from "../types";

export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// High-risk operations should support maker-checker where required — see
// PRD section 27. This guard only checks static role->permission grants;
// maker-checker approval flows live in the owning service.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenDomainError("Missing authenticated user context");
    }

    const hasAll = required.every((permission) => user.permissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenDomainError(`Missing required permission(s): ${required.join(", ")}`);
    }

    return true;
  }
}
