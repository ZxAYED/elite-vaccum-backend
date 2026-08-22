import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({
    enum: ProductOrderStatus,
    example: ProductOrderStatus.PROCESSING,
    description: 'Updated order / delivery status',
  })
  @IsOptional()
  @IsEnum(ProductOrderStatus)
  readonly status?: ProductOrderStatus;

  @ApiPropertyOptional({
    example: 'Package dispatched via FedEx Express',
    description: 'Timeline note or status update reason',
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({
    example: 'FX-8899223311',
    description: 'Shipping tracking number',
  })
  @IsOptional()
  @IsString()
  readonly trackingNumber?: string;

  @ApiPropertyOptional({
    example: 'FedEx Freight',
    description: 'Carrier / shipping provider name',
  })
  @IsOptional()
  @IsString()
  readonly shippingProvider?: string;
}
