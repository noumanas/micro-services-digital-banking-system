import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsUUID, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ format: "uuid", description: "Tenant to register this user under" })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: "jane@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 10, example: "correct-horse-battery" })
  @IsString()
  @MinLength(10)
  password!: string;
}
