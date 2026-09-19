import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

export class CreateVerificationDto {
  @ApiProperty({ format: "uuid", description: "Customer being verified" })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({
    enum: ["approve", "reject"],
    description: "Local/dev only: force the mock provider's decision",
  })
  @IsOptional()
  @IsIn(["approve", "reject"])
  simulate?: "approve" | "reject";
}
