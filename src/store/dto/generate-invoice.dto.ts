import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateInvoiceDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  regenerate?: boolean;
}
