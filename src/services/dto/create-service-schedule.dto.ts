import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateServiceScheduleDto {
  @ApiProperty({ example: 'service-request-id' })
  @IsString()
  serviceRequestId!: string;

  @ApiPropertyOptional({ example: 'service-quotation-id' })
  @IsOptional()
  @IsString()
  quotationId?: string;

  @ApiProperty({ example: '2026-05-10T10:30:00.000Z' })
  @IsDateString()
  scheduledDate!: string;

  @ApiPropertyOptional({ example: 'technician-user-id' })
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional({ example: '90' })
  @IsOptional()
  @IsString()
  estimatedDurationMinutes?: string;

  @ApiPropertyOptional({ example: 'Initial schedule by admin' })
  @IsOptional()
  @IsString()
  internalNote?: string;
}
