import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectServiceQuotationDto {
  @ApiPropertyOptional({ example: 'Not approved by admin' })
  @IsOptional()
  @IsString()
  reason?: string;
}
