import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability, ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ProductListQueryDto {
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
    example: 'Silent Master',
    description:
      'Quick search: searches name, model, part number, SKU, or summary',
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({
    example: 'central-vacuum-units',
    description: 'Filter by category UUID or unique slug',
  })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
    description: 'Filter by specific category UUID',
  })
  @IsOptional()
  @IsString()
  readonly categoryId?: string;

  @ApiPropertyOptional({
    example: 'central-vacuum-units',
    description: 'Filter by category slug',
  })
  @IsOptional()
  @IsString()
  readonly categorySlug?: string;

  @ApiPropertyOptional({
    enum: ProductStatus,
    description: 'Filter by Product status (Admin only: DRAFT, ACTIVE, ARCHIVED)',
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  readonly status?: ProductStatus;

  @ApiPropertyOptional({
    example: 'in_stock',
    description:
      'Filter availability: "all", "in_stock", "special_order", "out_of_stock", or Prisma enum value',
  })
  @IsOptional()
  @IsString()
  readonly availability?: string;

  @ApiPropertyOptional({
    example: '0-100',
    description:
      'Preset price ranges: "under_50" | "50-150" | "150-300" | "300+" | "0-100" | "101-500" | "501-1000" | "1000+"',
  })
  @IsOptional()
  @IsString()
  readonly priceRange?: string;

  @ApiPropertyOptional({ example: 100, description: 'Custom minimum price in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly minPrice?: number;

  @ApiPropertyOptional({ example: 2000, description: 'Custom maximum price in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly maxPrice?: number;

  @ApiPropertyOptional({
    example: 'popularity',
    description:
      'Quick sort presets: "popularity" | "price_asc" | "price_desc" | "newest" | "name_asc" | "name_desc"',
  })
  @IsOptional()
  @IsString()
  readonly sort?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1')
      return true;
    if (value === 'false' || value === false || value === 0 || value === '0')
      return false;
    return undefined;
  })
  @IsBoolean()
  readonly taxable?: boolean;

  @ApiPropertyOptional({
    example: 'createdAt',
    enum: [
      'createdAt',
      'updatedAt',
      'name',
      'priceUsd',
      'popularityRank',
      'quantity',
    ],
  })
  @IsOptional()
  @IsString()
  readonly sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  readonly sortOrder?: 'asc' | 'desc' = 'desc';
}
