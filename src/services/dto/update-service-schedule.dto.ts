import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateServiceScheduleDto {
  @ApiPropertyOptional({ example: '2026-05-11T14:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 'Customer requested new time' })
  @IsOptional()
  @IsString()
  reasonForReschedule?: string;

  @ApiPropertyOptional({ example: 'updated-technician-user-id' })
  @IsOptional()
  @IsString()
  technicianId?: string;
}
