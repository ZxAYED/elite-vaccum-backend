import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatConversationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({
    enum: ChatConversationType,
    default: ChatConversationType.SUPPORT,
    description: 'Type of conversation',
  })
  @IsOptional()
  @IsEnum(ChatConversationType)
  readonly type?: ChatConversationType = ChatConversationType.SUPPORT;

  @ApiPropertyOptional({
    example: 'Support Inquiry - Unit Diagnostic',
    description: 'Conversation title',
  })
  @IsOptional()
  @IsString()
  readonly title?: string;

  @ApiPropertyOptional({
    example: 'c1f7b8d4-5390-4a88-bb71-d6fe2e79601f',
    description: 'Target participant user ID (if starting a direct chat or admin messaging customer)',
  })
  @IsOptional()
  @IsUUID()
  readonly targetUserId?: string;

  @ApiPropertyOptional({
    example: 'ord-uuid-123',
    description: 'Linked E-commerce order ID',
  })
  @IsOptional()
  @IsUUID()
  readonly orderId?: string;

  @ApiPropertyOptional({
    example: 'so-uuid-777',
    description: 'Linked field service order ID',
  })
  @IsOptional()
  @IsUUID()
  readonly serviceOrderId?: string;

  @ApiPropertyOptional({
    example: 'Hello, I have a question regarding my recent service appointment.',
    description: 'Initial message content to send immediately',
  })
  @IsOptional()
  @IsString()
  readonly initialMessage?: string;
}
