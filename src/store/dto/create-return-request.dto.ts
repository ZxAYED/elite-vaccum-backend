import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReturnRequestDto {
  @ApiPropertyOptional({
    example: 'd92c7fa8-8924-4f01-a7eb-6237c569ef81',
    description: 'Specific ProductOrderItem UUID if returning only 1 item from the order',
  })
  @IsOptional()
  @IsUUID()
  readonly orderItemId?: string;

  @ApiProperty({
    example: 'DEFECTIVE_OR_DAMAGED',
    description: 'Reason for return request (e.g. DEFECTIVE_OR_DAMAGED, WRONG_ITEM, NOT_AS_DESCRIBED, OTHER)',
  })
  @IsString()
  readonly reason!: string;

  @ApiPropertyOptional({
    example: 'Unit power motor makes loud rattling noise upon first setup.',
    description: 'Detailed description of the issue from the customer',
  })
  @IsOptional()
  @IsString()
  readonly customerNote?: string;
}
