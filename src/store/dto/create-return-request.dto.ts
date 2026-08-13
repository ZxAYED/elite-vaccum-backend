import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReturnRequestDto {
  @ApiPropertyOptional({ example: 'store-order-item-id' })
  @IsOptional()
  @IsUUID()
  storeOrderItemId?: string;

  @ApiProperty({ example: 'Damaged item received' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ example: 'Box was intact but unit has crack on side.' })
  @IsOptional()
  @IsString()
  customerNote?: string;
}

