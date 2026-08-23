import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateServiceOrderDto {
  @ApiProperty({ example: 'e47b1234-5678-4321-9876-abcdef012345', description: 'Linked Service Request UUID' })
  @IsUUID()
  @IsNotEmpty()
  readonly serviceRequestId!: string;

  @ApiPropertyOptional({ example: 'd38a1234-5678-4321-9876-abcdef012345', description: 'Linked Quotation UUID' })
  @IsOptional()
  @IsUUID()
  readonly quotationId?: string;

  @ApiPropertyOptional({ example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83', description: 'Assigned Technician UUID' })
  @IsOptional()
  @IsUUID()
  readonly assignedTechnicianId?: string;

  @ApiProperty({ example: '2026-09-15T09:00:00.000Z', description: 'Scheduled start timestamp (ISO8601)' })
  @IsDateString()
  @IsNotEmpty()
  readonly scheduledAt!: string;

  @ApiPropertyOptional({ example: 90, default: 60, description: 'Estimated duration in minutes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  readonly estimatedDurationMin?: number = 60;

  @ApiProperty({ example: 450.0, description: 'Total agreed amount in USD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly totalUsd!: number;

  @ApiProperty({ example: 'Vacuum Motor Diagnostics and Line De-clogging', description: 'Job summary' })
  @IsString()
  @IsNotEmpty()
  readonly summary!: string;

  @ApiPropertyOptional({ example: 'Friendly dog in yard. Knock loud on front door.' })
  @IsOptional()
  @IsString()
  readonly customerNotes?: string;

  @ApiPropertyOptional({ example: 'Bring 120V replacement carbon brushes and optical line camera.' })
  @IsOptional()
  @IsString()
  readonly adminInstructions?: string;

  @ApiPropertyOptional({ enum: ServiceOrderStatus, default: ServiceOrderStatus.SCHEDULED })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  readonly status?: ServiceOrderStatus = ServiceOrderStatus.SCHEDULED;
}
