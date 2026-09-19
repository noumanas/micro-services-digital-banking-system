import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsISO4217CurrencyCode, IsUUID } from "class-validator";

export const ACCOUNT_TYPES = ["CURRENT", "SAVINGS", "BUSINESS", "WALLET"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export class CreateAccountDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ enum: ACCOUNT_TYPES, example: "CURRENT" })
  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;

  @ApiProperty({ example: "USD", description: "ISO 4217 currency code" })
  @IsISO4217CurrencyCode()
  currency!: string;
}
