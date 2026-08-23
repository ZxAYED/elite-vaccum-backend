import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({
    example: '2026-09-16',
    description: 'Rescheduled service date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  readonly date?: string;

  @ApiPropertyOptional({ example: '01:00 PM', description: 'New start time' })
  @IsOptional()
  @IsString()
  readonly startTime?: string;

  @ApiPropertyOptional({ example: '03:00 PM', description: 'New end time' })
  @IsOptional()
  @IsString()
  readonly endTime?: string;

  @ApiPropertyOptional({
    example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83',
    description: 'Reassigned technician UUID',
  })
  @IsOptional()
  @IsUUID()
  readonly technicianId?: string;

  @ApiPropertyOptional({
    example: 'CONFIRMED',
    description: 'Updated appointment status (CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED)',
  })
  @IsOptional()
  @IsString()
  readonly status?: string;

  @ApiPropertyOptional({
    example: 'Rescheduled due to customer conflict.',
    description: 'Updated admin dispatch note',
  })
  @IsOptional()
  @IsString()
  readonly adminNote?: string;

  @ApiPropertyOptional({ example: 'Notes for field technician' })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
