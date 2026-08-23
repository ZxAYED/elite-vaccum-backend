import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewModerationAction, ReviewStatus, ReviewType } from '@prisma/client';
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

export class ReviewListQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 10;

  @ApiPropertyOptional({ enum: ReviewType })
  @IsOptional()
  @IsEnum(ReviewType)
  readonly type?: ReviewType;

  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  readonly status?: ReviewStatus;

  @ApiPropertyOptional({ example: 'e47b1234-5678-4321-9876-abcdef012345' })
  @IsOptional()
  @IsUUID()
  readonly productId?: string;

  @ApiPropertyOptional({ example: 'c27a1234-5678-4321-9876-abcdef012345' })
  @IsOptional()
  @IsUUID()
  readonly serviceId?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  readonly rating?: number;
}

export class ModerateReviewDto {
  @ApiProperty({
    enum: ReviewModerationAction,
    example: ReviewModerationAction.PUBLISHED,
    description: 'Moderation action (PUBLISHED, HIDDEN, DELETED)',
  })
  @IsEnum(ReviewModerationAction)
  @IsNotEmpty()
  readonly action!: ReviewModerationAction;

  @ApiPropertyOptional({ example: 'Verified genuine customer service review' })
  @IsOptional()
  @IsString()
  readonly reason?: string;

  @ApiPropertyOptional({ example: 'Admin approval notes' })
  @IsOptional()
  @IsString()
  readonly note?: string;
}
