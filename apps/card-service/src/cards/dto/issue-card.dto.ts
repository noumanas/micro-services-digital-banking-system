import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsPositive, IsUUID } from "class-validator";

export const CARD_TYPES = ["VIRTUAL", "PHYSICAL"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export class IssueCardDto {
  @ApiProperty({ format: "uuid", description: "Must belong to the caller unless staff" })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ enum: CARD_TYPES, example: "VIRTUAL" })
  @IsIn(CARD_TYPES)
  type!: CardType;

  @ApiPropertyOptional({ description: "Daily spend limit in minor units; defaults to CARD_DEFAULT_DAILY_LIMIT" })
  @IsOptional()
  @IsInt()
  @IsPositive()
  dailyLimit?: number;
}
