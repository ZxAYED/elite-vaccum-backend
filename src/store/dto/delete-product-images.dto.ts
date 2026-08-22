import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { safeJsonParse } from 'src/common/utils/parseJsonPayload';

export class DeleteProductImagesDto {
  @ApiProperty({
    type: [String],
    description: 'Array of ProductImage UUIDs to delete',
    example: ['d92c7fa8-8924-4f01-a7eb-6237c569ef81'],
  })
  @Transform(({ value }) => safeJsonParse(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  readonly imageIds!: string[];
}
