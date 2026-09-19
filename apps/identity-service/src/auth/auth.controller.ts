import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { TenantContextStore } from "@digital-banking/shared";
import { Public } from "@digital-banking/auth";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Register a new customer user under a tenant" })
  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    const { correlationId } = TenantContextStore.getOrThrow();
    return this.authService.register(dto, correlationId);
  }

  @ApiOperation({ summary: "Log in and receive an access + refresh token pair" })
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    const { correlationId } = TenantContextStore.getOrThrow();
    return this.authService.login(dto, correlationId);
  }

  @ApiOperation({ summary: "Exchange a refresh token for a new access + refresh token pair" })
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: "Revoke a refresh token" })
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto);
  }
}
