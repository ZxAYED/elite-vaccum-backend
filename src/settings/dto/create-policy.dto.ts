import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ example: 'terms', description: 'Unique slug for URL routing (e.g. terms, privacy, returns)' })
  @IsString()
  @IsNotEmpty()
  readonly slug!: string;

  @ApiProperty({ example: 'Terms of Service', description: 'Policy title' })
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @ApiProperty({
    example: 'These Terms of Service govern your use of the Elite Central Vacuum website, store, and service-request system.',
    description: 'Full legal text or markdown body',
  })
  @IsString()
  @IsNotEmpty()
  readonly content!: string;

  @ApiPropertyOptional({ example: 'Published', default: 'Published', description: 'Published or Draft' })
  @IsOptional()
  @IsString()
  readonly status?: string = 'Published';
}

export class UpdatePolicyDto {
  @ApiPropertyOptional({ example: 'Terms of Service' })
  @IsOptional()
  @IsString()
  readonly title?: string;

  @ApiPropertyOptional({ example: 'Updated policy body content...' })
  @IsOptional()
  @IsString()
  readonly content?: string;

  @ApiPropertyOptional({ example: 'Published' })
  @IsOptional()
  @IsString()
  readonly status?: string;
}
