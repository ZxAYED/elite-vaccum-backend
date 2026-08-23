import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewType, example: ReviewType.PRODUCT, description: 'PRODUCT or SERVICE' })
  @IsEnum(ReviewType)
  @IsNotEmpty()
  readonly type!: ReviewType;

  @ApiPropertyOptional({ example: 'e47b1234-5678-4321-9876-abcdef012345', description: 'Product UUID if type is PRODUCT' })
  @IsOptional()
  @IsUUID()
  readonly productId?: string;

  @ApiPropertyOptional({ example: 'd38a1234-5678-4321-9876-abcdef012345', description: 'Product Order UUID if type is PRODUCT' })
  @IsOptional()
  @IsUUID()
  readonly productOrderId?: string;

  @ApiPropertyOptional({ example: 'c27a1234-5678-4321-9876-abcdef012345', description: 'Service UUID if type is SERVICE' })
  @IsOptional()
  @IsUUID()
  readonly serviceId?: string;

  @ApiPropertyOptional({ example: 'b16a1234-5678-4321-9876-abcdef012345', description: 'Service Order UUID if type is SERVICE' })
  @IsOptional()
  @IsUUID()
  readonly serviceOrderId?: string;

  @ApiProperty({ example: 5, description: 'Rating score from 1 to 5' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  readonly rating!: number;

  @ApiProperty({ example: 'Outstanding performance and suction power!', description: 'Review title' })
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @ApiProperty({
    example: 'The technician arrived exactly on time, cleared the pipe blockage, and our central vacuum is working like brand new.',
    description: 'Detailed review comment body',
  })
  @IsString()
  @IsNotEmpty()
  readonly body!: string;
}
