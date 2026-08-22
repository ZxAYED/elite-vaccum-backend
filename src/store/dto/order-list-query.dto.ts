import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class OrderListQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly limit?: number = 10;

  @ApiPropertyOptional({
    enum: ProductOrderStatus,
    description: 'Filter by order status',
  })
  @IsOptional()
  @IsEnum(ProductOrderStatus)
  readonly status?: ProductOrderStatus;

  @ApiPropertyOptional({
    example: 'ORD-20260822',
    description: 'Search by Order business ID, tracking number, or customer name',
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Filter by specific customer UUID (Admin only)',
  })
  @IsOptional()
  @IsUUID()
  readonly customerId?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  readonly dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  readonly dateTo?: string;

  @ApiPropertyOptional({ example: 'placedAt', default: 'placedAt' })
  @IsOptional()
  @IsString()
  readonly sortBy?: string = 'placedAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  readonly sortOrder?: 'asc' | 'desc' = 'desc';
}
