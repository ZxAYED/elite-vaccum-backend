import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceLineItemDto {
  @ApiProperty({ example: 'Central Vacuum Preventative Maintenance' })
  @IsString()
  @IsNotEmpty()
  readonly description!: string;

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly quantity: number = 1;

  @ApiProperty({ example: 120.0, description: 'Unit price in USD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly unitPriceUsd!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'e47b1234-5678-4321-9876-abcdef012345', description: 'Customer UUID' })
  @IsUUID()
  @IsNotEmpty()
  readonly customerId!: string;

  @ApiPropertyOptional({ example: 'd38a1234-5678-4321-9876-abcdef012345', description: 'Linked Service Order UUID' })
  @IsOptional()
  @IsUUID()
  readonly serviceOrderId?: string;

  @ApiPropertyOptional({ example: 'c27a1234-5678-4321-9876-abcdef012345', description: 'Linked Product Order UUID' })
  @IsOptional()
  @IsUUID()
  readonly productOrderId?: string;

  @ApiProperty({
    type: [CreateInvoiceLineItemDto],
    description: 'Itemized invoice line items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  readonly lineItems!: CreateInvoiceLineItemDto[];

  @ApiPropertyOptional({ example: 0.0, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly discountUsd?: number = 0;

  @ApiPropertyOptional({ example: 9.6, default: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly taxUsd?: number = 0;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Invoice due date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  readonly dueDate?: string;

  @ApiPropertyOptional({ example: 'Thank you for choosing Elite Central Vacuum.' })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, default: InvoiceStatus.ISSUED })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  readonly status?: InvoiceStatus = InvoiceStatus.ISSUED;
}
