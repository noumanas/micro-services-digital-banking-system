import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID } from "class-validator";

export class LoginDto {
  // Optional: a user's email is only unique per-tenant (see User's schema
  // comment), so when omitted, login() searches every tenant for a matching
  // email + password. Still accepted for API callers that already know
  // their tenant, or to disambiguate the rare case of the same email
  // existing in more than one tenant with the same password.
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ example: "jane@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
