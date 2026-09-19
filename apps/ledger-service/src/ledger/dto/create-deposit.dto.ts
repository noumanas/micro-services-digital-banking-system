import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsISO4217CurrencyCode, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CreateDepositDto {
  @ApiProperty({
    description: "Amount in minor units (cents) — e.g. 10000 for $100.00",
    example: 10000,
  })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "USD", description: "Must match the target account's currency" })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiPropertyOptional({ example: "Initial funding" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
