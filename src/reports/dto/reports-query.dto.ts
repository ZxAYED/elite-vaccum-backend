import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportsQueryDto {
  @ApiPropertyOptional({ example: '30d', description: 'Quick timeframe filter: 7d, 30d, 90d, 1y, all' })
  @IsOptional()
  @IsString()
  readonly period?: string = '30d';

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  readonly to?: string;
}
