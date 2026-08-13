import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RequestRescheduleDto {
  @ApiPropertyOptional({ example: 'Need to move appointment due to emergency' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: '2026-05-12T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}
