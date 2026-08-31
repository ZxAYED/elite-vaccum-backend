import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ChatMessageQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number = 30;

  @ApiPropertyOptional({
    example: '2026-08-31T12:00:00.000Z',
    description: 'Fetch messages created before this timestamp (cursor pagination)',
  })
  @IsOptional()
  @IsString()
  readonly before?: string;
}

export class ChatConversationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  readonly limit?: number = 20;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  readonly search?: string;
}
