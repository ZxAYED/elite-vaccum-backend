import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateAddressDto } from './create-address.dto';

export enum OrderPaymentMethod {
  STRIPE = 'STRIPE',
  COD = 'COD',
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description:
      'Existing customer delivery address UUID. If provided, order links to this saved address.',
  })
  @IsOptional()
  @IsUUID()
  readonly deliveryAddressId?: string;

  @ApiPropertyOptional({
    type: CreateAddressDto,
    description:
      'New delivery address payload. If deliveryAddressId is not provided, this creates and saves a new delivery address for the customer.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  readonly deliveryAddress?: CreateAddressDto;

  @ApiProperty({
    enum: OrderPaymentMethod,
    default: OrderPaymentMethod.STRIPE,
    example: OrderPaymentMethod.STRIPE,
    description: 'Payment method: strictly "STRIPE" or "COD" (Cash on Delivery)',
  })
  @IsEnum(OrderPaymentMethod)
  readonly paymentMethod!: OrderPaymentMethod;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Recipient name' })
  @IsOptional()
  @IsString()
  readonly recipientName?: string;

  @ApiPropertyOptional({ example: '+1-555-0199', description: 'Contact phone' })
  @IsOptional()
  @IsString()
  readonly contactPhone?: string;

  @ApiPropertyOptional({ example: 'customer@example.com', description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  readonly contactEmail?: string;

  @ApiPropertyOptional({
    example: 'Please leave at the front door if no answer',
    description: 'Delivery notes / instructions',
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
