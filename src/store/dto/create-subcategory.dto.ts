import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSubCategoryDto {
  @ApiProperty({ example: 'Power Units' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'category-id' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: 'power-units' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
