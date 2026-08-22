import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability, ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { safeJsonParse } from 'src/common/utils/parseJsonPayload';

export class ProductHighlightInputDto {
  @ApiProperty({ example: 'Ultra-quiet 58 dB sound level' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly text!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class ProductSpecificationInputDto {
  @ApiProperty({ example: 'Motor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly label!: string;

  @ApiProperty({ example: 'Dual-Stage Flow-Thru 120V' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly value!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class ProductShippingNoteInputDto {
  @ApiProperty({ example: 'Ships within 1-2 business days via FedEx Freight' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly text!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class ProductImageInputDto {
  @ApiPropertyOptional({ example: 'products/2026-08-22/image.jpg' })
  @IsOptional()
  @IsString()
  readonly key?: string;

  @ApiProperty({
    example: 'https://bucket.s3.amazonaws.com/products/image.jpg',
  })
  @IsString()
  @IsNotEmpty()
  readonly url!: string;

  @ApiPropertyOptional({ example: 'Front main unit view' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly alt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}

export class CreateProductDto {
  @ApiProperty({
    example: 'c1234567-89ab-cdef-0123-456789abcdef',
    description: 'Category UUID',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly categoryId!: string;

  @ApiProperty({ example: 'Silent Master S900 Central Vacuum Power Unit' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly name!: string;

  @ApiPropertyOptional({ example: 'S900-PRO-ELITE' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly model?: string;

  @ApiProperty({
    example: 'Heavy-duty central vacuum designed for large residential homes.',
  })
  @IsString()
  @IsNotEmpty()
  readonly summary!: string;

  @ApiProperty({
    example: 'Full rich HTML or markdown description of the power unit...',
  })
  @IsString()
  @IsNotEmpty()
  readonly description!: string;

  @ApiPropertyOptional({ example: 10, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly quantity?: number = 1;

  @ApiProperty({ example: 1299.99 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly priceUsd!: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductStatus)
  readonly status?: ProductStatus = ProductStatus.ACTIVE;

  @ApiPropertyOptional({
    enum: ProductAvailability,
    default: ProductAvailability.IN_STOCK,
  })
  @IsOptional()
  @IsEnum(ProductAvailability)
  readonly availability?: ProductAvailability = ProductAvailability.IN_STOCK;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(
    ({ value }) =>
      value === 'true' || value === true || value === 1 || value === '1',
  )
  @IsBoolean()
  readonly taxable?: boolean = true;

  @ApiPropertyOptional({ example: 'Free Standard Shipping' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly shippingLabel?: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly popularityRank?: number = 0;

  @ApiPropertyOptional({ example: 'Silent Master S900 Unit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly imageAlt?: string;

  @ApiPropertyOptional({
    type: [ProductHighlightInputDto],
    description:
      'Product highlights / bullet points. Can be JSON stringified when sent via multipart form-data.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = safeJsonParse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === 'string' ? { text: item } : item,
      );
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductHighlightInputDto)
  readonly highlights?: ProductHighlightInputDto[];

  @ApiPropertyOptional({
    type: [ProductSpecificationInputDto],
    description:
      'Product specifications. Can be JSON stringified when sent via multipart form-data.',
  })
  @IsOptional()
  @Transform(({ value }) => safeJsonParse(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationInputDto)
  readonly specifications?: ProductSpecificationInputDto[];

  @ApiPropertyOptional({
    type: [ProductShippingNoteInputDto],
    description:
      'Shipping notes. Can be JSON stringified when sent via multipart form-data.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const parsed = safeJsonParse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === 'string' ? { text: item } : item,
      );
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductShippingNoteInputDto)
  readonly shippingNotes?: ProductShippingNoteInputDto[];

  @ApiPropertyOptional({
    type: [ProductImageInputDto],
    description: 'Existing image URLs or metadata. Can be JSON stringified.',
  })
  @IsOptional()
  @Transform(({ value }) => safeJsonParse(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  readonly images?: ProductImageInputDto[];
}
