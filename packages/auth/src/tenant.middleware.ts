import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { TenantContextStore } from "@digital-banking/shared";
import { AuthenticatedUser } from "./types";

const TENANT_HEADER = "x-tenant-id";
const CORRELATION_HEADER = "x-correlation-id";

// Tenant isolation must be enforced at the API layer among others (PRD
// section 25). Authenticated requests trust the tenantId embedded in the
// JWT over the header, so a caller cannot widen its own access by spoofing
// the header; unauthenticated routes (e.g. login) fall back to the header.
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.header(CORRELATION_HEADER) as string) ?? randomUUID();
    res.setHeader(CORRELATION_HEADER, correlationId);

    const user = (req as unknown as { user?: AuthenticatedUser }).user;
    const tenantId = user?.tenantId ?? (req.header(TENANT_HEADER) as string) ?? "";

    TenantContextStore.run({ tenantId, correlationId, userId: user?.userId }, () => next());
  }
}
