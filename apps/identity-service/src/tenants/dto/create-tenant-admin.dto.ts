import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateTenantAdminDto {
  @ApiProperty({ example: "admin@acmebank.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 10, example: "correct-horse-battery" })
  @IsString()
  @MinLength(10)
  password!: string;
}
