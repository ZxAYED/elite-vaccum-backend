import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductAvailability } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateProductStockDto {
  @ApiProperty({ example: 25, description: 'Updated inventory count' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly quantity!: number;

  @ApiPropertyOptional({
    enum: ProductAvailability,
    description: 'Optional availability status override',
  })
  @IsOptional()
  @IsEnum(ProductAvailability)
  readonly availability?: ProductAvailability;
}
