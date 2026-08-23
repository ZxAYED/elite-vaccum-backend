import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuotationLineItemInputDto {
  @ApiProperty({ example: 'Power Unit Motor Replacement (Labor + OEM Part)' })
  @IsString()
  @IsNotEmpty()
  readonly description!: string;

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly quantity: number = 1;

  @ApiProperty({ example: 450.0, description: 'Unit price in USD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly unitPriceUsd!: number;

  @ApiPropertyOptional({ example: 'OEM Beam 120V motor assembly' })
  @IsOptional()
  @IsString()
  readonly note?: string;
}

export class CreateQuotationDto {
  @ApiProperty({ example: 'e47b1234-5678-4321-9876-abcdef012345', description: 'Target Service Request UUID' })
  @IsUUID()
  @IsNotEmpty()
  readonly serviceRequestId!: string;

  @ApiProperty({
    type: [QuotationLineItemInputDto],
    description: 'Itemized quotation line items (labor, parts, materials)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationLineItemInputDto)
  readonly lineItems!: QuotationLineItemInputDto[];

  @ApiPropertyOptional({ example: 25.0, default: 0.0, description: 'Discount amount in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly discountUsd?: number = 0;

  @ApiPropertyOptional({ example: 34.0, default: 0.0, description: 'Tax amount in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly taxUsd?: number = 0;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Quotation expiration date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  readonly expiresAt?: string;

  @ApiPropertyOptional({ example: 'Includes 1-year parts warranty and 90-day labor guarantee.' })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({ example: 'Payment due upon completion of on-site service.' })
  @IsOptional()
  @IsString()
  readonly terms?: string;
}
