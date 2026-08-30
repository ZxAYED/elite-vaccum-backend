import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { QuotationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CreateQuotationDto } from './create-quotation.dto';

export class UpdateQuotationDto extends PartialType(CreateQuotationDto) {
  @ApiPropertyOptional({ example: 'Customer requested updated pricing with higher volume discount.' })
  @IsOptional()
  @IsString()
  readonly revisionReason?: string;
}

export class QuotationListQueryDto {
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

  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  readonly status?: QuotationStatus;

  @ApiPropertyOptional({ example: 'QUO-2026' })
  @IsOptional()
  @IsString()
  readonly search?: string;
}

export enum QuotationDecisionAction {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class UpdateQuotationStatusDto {
  @ApiProperty({
    enum: QuotationDecisionAction,
    example: QuotationDecisionAction.ACCEPTED,
    description: 'Decision action to accept or reject the quotation',
  })
  @IsEnum(QuotationDecisionAction)
  @IsNotEmpty()
  readonly action!: QuotationDecisionAction;

  @ApiPropertyOptional({
    example: 'Budget constraints / Found alternative option',
    description: 'Rejection reason (used if action is REJECTED)',
  })
  @IsOptional()
  @IsString()
  readonly reason?: string;

  @ApiPropertyOptional({
    example: 'Customer notes or feedback',
    description: 'Additional comments',
  })
  @IsOptional()
  @IsString()
  readonly comments?: string;
}

export class RejectQuotationDto {
  @ApiPropertyOptional({ example: 'Found alternative solution / price consideration', description: 'Rejection reason' })
  @IsString()
  @IsNotEmpty()
  readonly reason!: string;

  @ApiPropertyOptional({ example: 'Customer opted for partial repair instead of full replacement.' })
  @IsOptional()
  @IsString()
  readonly comments?: string;
}
