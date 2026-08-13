import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'shipping-address-id' })
  @IsUUID()
  shippingAddressId!: string;

  @ApiPropertyOptional({ example: 'billing-address-id' })
  @IsOptional()
  @IsUUID()
  billingAddressId?: string;

  @ApiPropertyOptional({ example: 'Leave at front door' })
  @IsOptional()
  @IsString()
  notes?: string;
}

