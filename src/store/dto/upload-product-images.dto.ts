import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadProductImagesDto {
  @ApiPropertyOptional({
    description: 'Custom alt text for uploaded images. Defaults to product name.',
    example: 'Front unit view',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly alt?: string;

  @ApiPropertyOptional({
    description: 'Set the first uploaded image as primary product image',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  readonly isPrimary?: boolean;
}
