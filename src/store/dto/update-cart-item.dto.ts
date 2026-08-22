import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ example: 2, description: 'Updated quantity (1 - 100)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly quantity!: number;
}
