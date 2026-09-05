import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ServiceListQueryDto {
  @ApiPropertyOptional({ description: 'Search term by title, slug, or description' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ description: 'Filter by status: ACTIVE, INACTIVE, or all' })
  @IsOptional()
  @IsString()
  readonly status?: string;

  @ApiPropertyOptional({ description: 'Filter by group: SERVICE_AND_MAINTENANCE, INSTALLATION, or all' })
  @IsOptional()
  @IsString()
  readonly group?: string;

  @ApiPropertyOptional({ description: 'Sorting preset: newest, oldest, name-asc, name-desc, display-order' })
  @IsOptional()
  @IsString()
  readonly sort?: string;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  readonly sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction: asc or desc' })
  @IsOptional()
  @IsString()
  readonly sortOrder?: 'asc' | 'desc';
}
