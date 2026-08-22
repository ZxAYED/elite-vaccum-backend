import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { safeJsonParse } from 'src/common/utils/parseJsonPayload';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Array of ProductImage UUIDs to delete from database and AWS S3 storage. Can be JSON stringified.',
    example: ['d92c7fa8-8924-4f01-a7eb-6237c569ef81'],
  })
  @IsOptional()
  @Transform(({ value }) => safeJsonParse(value))
  @IsArray()
  @IsString({ each: true })
  readonly deleteImageIds?: string[];
}
