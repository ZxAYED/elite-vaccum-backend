import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminReturnNoteDto {
  @ApiPropertyOptional({ example: 'Approved after image verification.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
