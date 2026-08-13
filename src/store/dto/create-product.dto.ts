import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, TaxMode } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductFeatureInputDto {
  @ApiPropertyOptional({ example: 'shield-check' })
  @IsOptional()
  @IsString()
  iconKey?: string;

  @ApiProperty({ example: '10-Year Comprehensive Warranty' })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductImageInputDto {
  @ApiProperty({ example: 'https://cdn.example.com/products/item-1.jpg' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'Front view' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Elite 500 Performance' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: 'category-id' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'subcategory-id' })
  @IsUUID()
  subCategoryId!: string;

  @ApiPropertyOptional({ example: 'E500-PRO' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'High-performance central vacuum unit' })
  @IsOptional()
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Full rich description here...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 899 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ enum: TaxMode, default: TaxMode.TAXABLE })
  @IsOptional()
  @IsEnum(TaxMode)
  taxable?: TaxMode;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRatePercent?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingWeight?: number;

  @ApiPropertyOptional({ example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dimensionLength?: number;

  @ApiPropertyOptional({ example: 10.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dimensionWidth?: number;

  @ApiPropertyOptional({ example: 8.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dimensionHeight?: number;

  @ApiPropertyOptional({ example: '10-year comprehensive warranty' })
  @IsOptional()
  @IsString()
  warrantyInfo?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/manuals/elite-500.pdf' })
  @IsOptional()
  @IsUrl()
  manualPdfUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['hepa', 'quiet'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [String], example: ['120V', 'Dual-stage motor'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specifications?: string[];

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ProductImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];

  @ApiPropertyOptional({ type: [ProductFeatureInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFeatureInputDto)
  features?: ProductFeatureInputDto[];
}

