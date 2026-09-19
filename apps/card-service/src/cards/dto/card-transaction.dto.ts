import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsISO4217CurrencyCode, IsPositive, IsString, MaxLength } from "class-validator";

export class CardTransactionDto {
  @ApiProperty({ description: "Amount in minor units (cents)", example: 2599 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "USD" })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiProperty({ example: "Corner Coffee Shop" })
  @IsString()
  @MaxLength(200)
  merchantName!: string;
}
