import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by read status (true = only read, false = only unread)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by notification category type',
    enum: NotificationType,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page (max 100)',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;
}
