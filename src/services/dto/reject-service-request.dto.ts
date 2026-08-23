import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectServiceRequestDto {
  @ApiProperty({
    example: 'Out of service territory / capacity unavailable',
    description: 'Primary reason for rejecting the service request',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  readonly reason!: string;

  @ApiPropertyOptional({
    example: 'We currently do not service the requested county. Recommended local affiliate contact provided.',
    description: 'Detailed explanation or internal note regarding the rejection',
  })
  @IsOptional()
  @IsString()
  readonly comments?: string;
}
