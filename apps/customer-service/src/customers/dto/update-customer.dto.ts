import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Jane" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "+1-555-0100" })
  @IsOptional()
  @IsString()
  phone?: string;
}
