import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateShipmentDto {
  @ApiPropertyOptional({ default: 'UPS' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ example: '2026-04-20T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  shipmentDate?: string;

  @ApiPropertyOptional({ example: '2026-04-24T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deliveryEstimate?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus, default: ShipmentStatus.PENDING })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

