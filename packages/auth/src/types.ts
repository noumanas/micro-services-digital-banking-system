import { Permission, Role } from "@digital-banking/shared";

export interface AccessTokenPayload {
  sub: string; // userId
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
}
