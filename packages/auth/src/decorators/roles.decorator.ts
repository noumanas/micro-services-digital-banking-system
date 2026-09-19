import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ForbiddenDomainError, Role } from "@digital-banking/shared";
import { AuthenticatedUser } from "../types";

export const ROLES_KEY = "roles";
export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenDomainError(`Requires one of role(s): ${required.join(", ")}`);
    }

    return true;
  }
}
