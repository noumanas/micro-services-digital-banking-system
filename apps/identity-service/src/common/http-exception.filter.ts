import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Response } from "express";
import { DomainError } from "@digital-banking/shared";
import { TenantContextStore } from "@digital-banking/shared";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const correlationId = TenantContextStore.get()?.correlationId;

    if (exception instanceof DomainError) {
      response.status(exception.statusCode).json({
        error: exception.code,
        message: exception.message,
        correlationId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: HttpStatus[status] ?? "ERROR",
        message: exception.message,
        correlationId,
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      correlationId,
    });
  }
}
