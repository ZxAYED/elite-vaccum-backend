import { PartialType } from '@nestjs/swagger';
import { CreateShipmentDto } from './create-shipment.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {
  @ApiPropertyOptional({ example: '2026-04-24T17:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  deliveredAt?: string;
}

