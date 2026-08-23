import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ServiceOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CreateServiceOrderDto } from './create-service-order.dto';

export class UpdateServiceOrderDto extends PartialType(CreateServiceOrderDto) {}

export class ServiceOrderListQueryDto {
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

  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  readonly status?: ServiceOrderStatus;

  @ApiPropertyOptional({ example: 'SO-2026' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83' })
  @IsOptional()
  @IsUUID()
  readonly technicianId?: string;
}

export class UpdateServiceOrderStatusDto {
  @ApiProperty({ enum: ServiceOrderStatus, example: ServiceOrderStatus.IN_PROGRESS })
  @IsEnum(ServiceOrderStatus)
  @IsNotEmpty()
  readonly status!: ServiceOrderStatus;

  @ApiPropertyOptional({ example: 'Technician arrived on site and started diagnostics.' })
  @IsOptional()
  @IsString()
  readonly note?: string;
}

export class AssignServiceOrderTechnicianDto {
  @ApiProperty({ example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83' })
  @IsUUID()
  @IsNotEmpty()
  readonly technicianId!: string;

  @ApiPropertyOptional({ example: 'Assigned for immediate on-site dispatch.' })
  @IsOptional()
  @IsString()
  readonly note?: string;
}

export class UpdateEtaDto {
  @ApiProperty({ example: 25, description: 'Estimated arrival time in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly minutes!: number;
}
