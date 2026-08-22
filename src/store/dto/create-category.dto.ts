import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Central Vacuum Units',
    description: 'Category name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly name!: string;

  @ApiPropertyOptional({
    example: 'central-vacuum-units',
    description: 'Unique category slug. Auto-generated from name if omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly slug?: string;

  @ApiPropertyOptional({
    example: 'Complete range of central vacuum power units',
    description: 'Category description',
  })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', default: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly status?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number;
}
