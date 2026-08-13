import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceRequestStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateServiceRequestDto {
  @ApiPropertyOptional({ example: 'Updated issue details' })
  @IsOptional()
  @IsString()
  problemDescription?: string;

  @ApiPropertyOptional({ example: 'Updated additional notes' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiPropertyOptional({ example: 'Updated previous machine info' })
  @IsOptional()
  @IsString()
  previousMachineInfo?: string;

  @ApiPropertyOptional({ example: '2026-04-22T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiPropertyOptional({ example: 'Afternoon' })
  @IsOptional()
  @IsString()
  preferredTime?: string;

  @ApiPropertyOptional({ enum: ServiceRequestStatus })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  status?: ServiceRequestStatus;

  @ApiPropertyOptional({ example: 'Internal admin note' })
  @IsOptional()
  @IsString()
  adminInternalNote?: string;
}
