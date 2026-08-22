import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability, ProductStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateProductStatusDto {
  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  @IsEnum(ProductStatus)
  readonly status!: ProductStatus;

  @ApiPropertyOptional({
    enum: ProductAvailability,
    example: ProductAvailability.IN_STOCK,
  })
  @IsOptional()
  @IsEnum(ProductAvailability)
  readonly availability?: ProductAvailability;
}
