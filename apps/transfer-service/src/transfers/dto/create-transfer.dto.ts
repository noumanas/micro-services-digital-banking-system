import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsISO4217CurrencyCode, IsPositive, IsUUID } from "class-validator";

export class CreateTransferDto {
  @ApiProperty({ format: "uuid", description: "Must belong to the caller unless staff" })
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  destinationAccountId!: string;

  @ApiProperty({ description: "Amount in minor units (cents)", example: 2500 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "USD" })
  @IsISO4217CurrencyCode()
  currency!: string;
}
