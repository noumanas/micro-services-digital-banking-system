import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "@digital-banking/auth";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok", service: "account-service" };
  }
}
