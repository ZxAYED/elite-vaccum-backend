import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestUrgency, ServiceRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ServiceRequestListQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 10;

  @ApiPropertyOptional({
    enum: ServiceRequestStatus,
    description: 'Filter by request status',
  })
  @IsOptional()
  @IsEnum(ServiceRequestStatus)
  readonly status?: ServiceRequestStatus;

  @ApiPropertyOptional({
    enum: RequestUrgency,
    description: 'Filter by urgency level',
  })
  @IsOptional()
  @IsEnum(RequestUrgency)
  readonly urgency?: RequestUrgency;

  @ApiPropertyOptional({
    example: 'low-suction-fix',
    description: 'Filter by service slug',
  })
  @IsOptional()
  @IsString()
  readonly serviceSlug?: string;

  @ApiPropertyOptional({
    example: 'REQ-202608',
    description: 'Search query across businessId, title, customer name, email, phone, city',
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsString()
  readonly dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsString()
  readonly dateTo?: string;

  @ApiPropertyOptional({
    enum: ['submittedAt', 'updatedAt', 'preferredDate'],
    default: 'submittedAt',
  })
  @IsOptional()
  @IsString()
  readonly sortBy?: string = 'submittedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  readonly sortOrder?: 'asc' | 'desc' = 'desc';
}
