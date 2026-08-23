import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Linked Service Order UUID (if already converted)',
  })
  @IsOptional()
  @IsUUID()
  readonly serviceOrderId?: string;

  @ApiPropertyOptional({
    example: 'e82b7fa8-8924-4f01-a7eb-6237c569ef82',
    description: 'Linked Service Request UUID',
  })
  @IsOptional()
  @IsUUID()
  readonly serviceRequestId?: string;

  @ApiProperty({
    example: '2026-09-15',
    description: 'Scheduled service appointment date (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  readonly date!: string;

  @ApiProperty({
    example: '09:00 AM',
    description: 'Appointment window start time (e.g. "09:00 AM")',
  })
  @IsString()
  @IsNotEmpty()
  readonly startTime!: string;

  @ApiProperty({
    example: '11:00 AM',
    description: 'Appointment window end time (e.g. "11:00 AM")',
  })
  @IsString()
  @IsNotEmpty()
  readonly endTime!: string;

  @ApiPropertyOptional({
    example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83',
    description: 'Assigned Technician UUID (optional, can be assigned later)',
  })
  @IsOptional()
  @IsUUID()
  readonly technicianId?: string;

  @ApiPropertyOptional({
    enum: ServiceOrderStatus,
    default: ServiceOrderStatus.SCHEDULED,
    description: 'Initial status of the scheduled service order',
  })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  readonly status?: ServiceOrderStatus = ServiceOrderStatus.SCHEDULED;

  @ApiPropertyOptional({
    example: 'Customer requested calling 30 minutes prior to arrival. Gate code #4321.',
    description: 'Internal admin / dispatcher instructions for the technician',
  })
  @IsOptional()
  @IsString()
  readonly adminNote?: string;

  @ApiPropertyOptional({
    example: 'Bring 2-inch standard replacement PVC sweep elbows and low-voltage multimeter.',
    description: 'General dispatch notes',
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
