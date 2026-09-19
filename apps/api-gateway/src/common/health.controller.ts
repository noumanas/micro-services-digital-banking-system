import { Controller, Get } from "@nestjs/common";
import { Public } from "@digital-banking/auth";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok", service: "api-gateway" };
  }
}
