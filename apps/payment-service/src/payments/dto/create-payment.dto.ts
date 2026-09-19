import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsISO4217CurrencyCode, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";

export const PAYMENT_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export class CreatePaymentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  accountId!: string;

  @ApiProperty({
    enum: PAYMENT_DIRECTIONS,
    description: "INBOUND = money arriving from outside the bank; OUTBOUND = money leaving to an external payee",
  })
  @IsIn(PAYMENT_DIRECTIONS)
  direction!: PaymentDirection;

  @ApiProperty({ description: "Amount in minor units (cents)", example: 1500 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "USD" })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiPropertyOptional({ example: "INV-2026-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;

  @ApiPropertyOptional({
    enum: ["approve", "decline"],
    description: "Local/dev only: force the mock provider's decision",
  })
  @IsOptional()
  @IsIn(["approve", "decline"])
  simulate?: "approve" | "decline";
}
