import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CategoryListQueryDto {
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

  @ApiPropertyOptional({ example: 'vacuum', description: 'Search term' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Filter by category status',
  })
  @IsOptional()
  @IsString()
  readonly status?: string;

  @ApiPropertyOptional({
    example: 'sortOrder',
    enum: ['sortOrder', 'name', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  readonly sortBy?: string = 'sortOrder';

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  readonly sortOrder?: 'asc' | 'desc' = 'asc';
}
