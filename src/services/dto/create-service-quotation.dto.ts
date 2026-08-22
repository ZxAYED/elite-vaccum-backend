import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceQuotationDto {
  @ApiProperty({ example: 'service-request-id' })
  @IsString()
  serviceRequestId!: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Quotation validity in hours',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  validityPeriodInHours?: number;
}
