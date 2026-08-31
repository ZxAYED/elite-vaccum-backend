import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateTechnicianProfileDto {
  @ApiPropertyOptional({ example: 'Naomi Carter' })
  @IsOptional()
  @IsString()
  readonly displayName?: string;

  @ApiPropertyOptional({ example: '+1 (914) 555-0141' })
  @IsOptional()
  @IsString()
  readonly phone?: string;

  @ApiPropertyOptional({
    example: ['Maintenance Visits', 'Accessory Fit Service', 'Pipe Flush'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly specializations?: string[];
}

export enum TechnicianAvailabilityMode {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  ON_BREAK = 'ON_BREAK',
  OFF_DUTY = 'OFF_DUTY',
}

export class UpdateTechnicianAvailabilityDto {
  @ApiProperty({
    enum: TechnicianAvailabilityMode,
    example: TechnicianAvailabilityMode.AVAILABLE,
  })
  @IsNotEmpty()
  @IsString()
  readonly availability!: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  readonly timezone?: string;
}

export class TechnicianJobsQueryDto {
  @ApiPropertyOptional({
    enum: ['today', 'upcoming', 'in_progress', 'completed', 'all'],
    default: 'today',
  })
  @IsOptional()
  @IsString()
  readonly tab?: 'today' | 'upcoming' | 'in_progress' | 'completed' | 'all' = 'today';

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  readonly limit?: number = 20;
}

export class TechnicianScheduleQueryDto {
  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsString()
  readonly from?: string;

  @ApiPropertyOptional({ example: '2026-08-16' })
  @IsOptional()
  @IsString()
  readonly to?: string;
}

export class RequestScheduleChangeDto {
  @ApiPropertyOptional({ example: 'so-uuid-123' })
  @IsOptional()
  @IsUUID()
  readonly serviceOrderId?: string;

  @ApiProperty({
    example: 'Access delay due to road closure on highway 287',
    description: 'Detailed reason for the schedule adjustment request',
  })
  @IsString()
  @IsNotEmpty()
  readonly reason!: string;

  @ApiPropertyOptional({ example: '2026-08-14' })
  @IsOptional()
  @IsString()
  readonly proposedDate?: string;

  @ApiPropertyOptional({ example: '01:00 PM - 03:00 PM' })
  @IsOptional()
  @IsString()
  readonly proposedTimeWindow?: string;
}
