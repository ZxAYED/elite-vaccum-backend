import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MessageAttachmentInputDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../photo.jpg' })
  @IsString()
  @IsNotEmpty()
  readonly fileUrl!: string;

  @ApiProperty({ example: 'unit_inlet_photo.jpg' })
  @IsString()
  @IsNotEmpty()
  readonly fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  readonly fileType!: string;

  @ApiPropertyOptional({ example: 2048576 })
  @IsOptional()
  @IsNumber()
  readonly fileSize?: number;
}

export class SendChatMessageDto {
  @ApiProperty({
    example: 'Can a technician check the second floor low-voltage wire?',
    description: 'Message text content',
  })
  @IsString()
  @IsNotEmpty()
  readonly content!: string;

  @ApiPropertyOptional({
    enum: ChatMessageType,
    default: ChatMessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(ChatMessageType)
  readonly type?: ChatMessageType = ChatMessageType.TEXT;

  @ApiPropertyOptional({
    type: [MessageAttachmentInputDto],
    description: 'Optional file attachments uploaded to Cloudinary',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentInputDto)
  readonly attachments?: MessageAttachmentInputDto[];
}
