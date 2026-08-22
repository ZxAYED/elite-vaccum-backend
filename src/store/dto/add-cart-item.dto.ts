import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsUUID, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Product UUID to add to cart',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly productId!: string;

  @ApiProperty({ example: 1, default: 1, description: 'Quantity of the item (1 - 100)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly quantity!: number;
}
