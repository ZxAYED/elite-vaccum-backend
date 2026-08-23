import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class InvoiceListQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 10;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  readonly status?: InvoiceStatus;

  @ApiPropertyOptional({ example: 'INV-2026' })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({ example: 'e47b1234-5678-4321-9876-abcdef012345' })
  @IsOptional()
  @IsUUID()
  readonly customerId?: string;
}

export class RecordPaymentDto {
  @ApiProperty({ example: 129.6, description: 'Amount paid in USD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  readonly amountUsd!: number;

  @ApiProperty({
    example: 'Credit Card',
    description: 'Payment method label (e.g. Stripe, Credit Card, Cash, Check, Wire)',
  })
  @IsString()
  @IsNotEmpty()
  readonly methodLabel!: string;

  @ApiPropertyOptional({ example: 'ch_3M4oabc123xyz', description: 'Stripe charge / Check #' })
  @IsOptional()
  @IsString()
  readonly transactionReference?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.SUCCEEDED })
  @IsOptional()
  @IsEnum(PaymentStatus)
  readonly status?: PaymentStatus = PaymentStatus.SUCCEEDED;
}

export class RecordRefundDto {
  @ApiProperty({ example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83', description: 'Payment UUID to refund against' })
  @IsUUID()
  @IsNotEmpty()
  readonly paymentId!: string;

  @ApiProperty({ example: 50.0, description: 'Refund amount in USD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  readonly amountUsd!: number;

  @ApiProperty({ example: 'Customer requested partial refund for unused parts warranty package.' })
  @IsString()
  @IsNotEmpty()
  readonly reason!: string;
}
