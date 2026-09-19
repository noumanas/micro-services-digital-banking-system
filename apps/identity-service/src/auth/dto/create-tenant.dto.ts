import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateTenantDto {
  @ApiProperty({ minLength: 2, example: "Acme Bank" })
  @IsString()
  @MinLength(2)
  name!: string;
}
