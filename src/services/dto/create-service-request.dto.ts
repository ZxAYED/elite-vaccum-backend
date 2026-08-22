import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateServiceRequestDto {
  @ApiProperty({
    example: 'service-type-id',
    description: 'Requested service ID (maps to service type)',
  })
  @IsString()
  serviceId!: string;

  @ApiPropertyOptional({ example: 'address-id' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ example: 'customer-machine-id' })
  @IsOptional()
  @IsString()
  customerMachineId?: string;

  @ApiPropertyOptional({ example: 'Garage and first floor' })
  @IsOptional()
  @IsString()
  serviceLocationText?: string;

  @ApiPropertyOptional({ example: '2026-04-20T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiPropertyOptional({ example: 'Morning' })
  @IsOptional()
  @IsString()
  preferredTime?: string;

  @ApiPropertyOptional({ example: 'Unit does not turn on and suction is low.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Please call before arrival.' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiPropertyOptional({ example: 'Repaired once last year.' })
  @IsOptional()
  @IsString()
  previousMachineInfo?: string;
}
