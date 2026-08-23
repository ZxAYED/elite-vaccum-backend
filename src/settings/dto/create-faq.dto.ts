import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({
    example: 'How often should a central vacuum system be serviced?',
    description: 'Customer-facing question',
  })
  @IsString()
  @IsNotEmpty()
  readonly question!: string;

  @ApiProperty({
    example: 'We recommend comprehensive preventative maintenance every 12 to 18 months to ensure peak suction and motor longevity.',
    description: 'Helpful, complete answer',
  })
  @IsString()
  @IsNotEmpty()
  readonly answer!: string;

  @ApiProperty({
    example: 'General',
    description: 'Category (e.g. General, Maintenance, Installation, Repair)',
  })
  @IsString()
  @IsNotEmpty()
  readonly category!: string;

  @ApiPropertyOptional({
    example: 'Published',
    default: 'Published',
    description: 'Status (Published or Draft)',
  })
  @IsOptional()
  @IsString()
  readonly status?: string = 'Published';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  readonly sortOrder?: number = 0;
}

export class UpdateFaqDto {
  @ApiPropertyOptional({ example: 'Updated question' })
  @IsOptional()
  @IsString()
  readonly question?: string;

  @ApiPropertyOptional({ example: 'Updated answer' })
  @IsOptional()
  @IsString()
  readonly answer?: string;

  @ApiPropertyOptional({ example: 'Maintenance' })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({ example: 'Published' })
  @IsOptional()
  @IsString()
  readonly status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  readonly sortOrder?: number;
}
