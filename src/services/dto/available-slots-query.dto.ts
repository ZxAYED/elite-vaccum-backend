import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiProperty({
    example: '2026-09-15',
    description: 'Target booking date (YYYY-MM-DD)',
  })
  @IsDateString()
  readonly date!: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Optional specific technician UUID or User UUID to filter availability for',
  })
  @IsOptional()
  @IsString()
  readonly technicianId?: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Optional alias for technicianId',
  })
  @IsOptional()
  @IsString()
  readonly techId?: string;
}

export class ScheduleBoardQueryDto {
  @ApiProperty({
    example: '2026-09-01',
    description: 'Start date of dispatch calendar board (YYYY-MM-DD)',
  })
  @IsDateString()
  readonly dateFrom!: string;

  @ApiProperty({
    example: '2026-09-30',
    description: 'End date of dispatch calendar board (YYYY-MM-DD)',
  })
  @IsDateString()
  readonly dateTo!: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Optional technician UUID filter. If omitted or "all", returns schedule across all technicians.',
  })
  @IsOptional()
  @IsString()
  readonly technicianId?: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Optional alias for technicianId',
  })
  @IsOptional()
  @IsString()
  readonly techId?: string;

  @ApiPropertyOptional({
    example: 'CONFIRMED',
    description: 'Optional appointment status filter (CONFIRMED, RESCHEDULED, CANCELLED, COMPLETED)',
  })
  @IsOptional()
  @IsString()
  readonly status?: string;
}
