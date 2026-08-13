import { ApiProperty } from '@nestjs/swagger';
import { StoreOrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: StoreOrderStatus })
  @IsEnum(StoreOrderStatus)
  status!: StoreOrderStatus;
}

