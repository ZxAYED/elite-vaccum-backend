import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiProperty({
    example: '2026-09-15',
    description: 'Target booking date (YYYY-MM-DD)',
  })
  @IsDateString()
  readonly date!: string;

  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Optional specific technician UUID to filter availability for',
  })
  @IsOptional()
  @IsUUID()
  readonly technicianId?: string;
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
    description: 'Optional technician UUID filter',
  })
  @IsOptional()
  @IsUUID()
  readonly technicianId?: string;

  @ApiPropertyOptional({
    example: 'CONFIRMED',
    description: 'Optional appointment status filter (CONFIRMED, RESCHEDULED, CANCELLED, COMPLETED)',
  })
  @IsOptional()
  readonly status?: string;
}
