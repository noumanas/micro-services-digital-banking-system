export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, "NOT_FOUND", 404);
  }
}

export class ConflictDomainError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class UnauthorizedDomainError extends DomainError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenDomainError extends DomainError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}
