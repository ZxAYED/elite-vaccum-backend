import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TechnicianStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CreateTechnicianDto } from './create-technician.dto';

export class UpdateTechnicianDto extends PartialType(CreateTechnicianDto) {
  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @IsNumber()
  readonly rating?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  readonly completedJobs?: number;
}

export class TechnicianListQueryDto {
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

  @ApiPropertyOptional({ enum: TechnicianStatus })
  @IsOptional()
  @IsEnum(TechnicianStatus)
  readonly status?: TechnicianStatus;

  @ApiPropertyOptional({ example: 'Alex' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ example: 'VACUUM_REPAIR' })
  @IsOptional()
  @IsString()
  readonly specialization?: string;
}
