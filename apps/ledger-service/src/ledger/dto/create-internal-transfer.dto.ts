import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsISO4217CurrencyCode, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateInternalTransferDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  destinationAccountId!: string;

  @ApiProperty({ description: "Amount in minor units (cents)", example: 5000 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "USD" })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
