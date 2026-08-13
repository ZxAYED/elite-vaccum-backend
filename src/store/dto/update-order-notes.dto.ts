import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateOrderNotesDto {
  @ApiProperty({ example: 'Internal note for fulfillment team' })
  @IsString()
  notes!: string;
}

