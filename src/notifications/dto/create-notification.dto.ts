import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Target User UUID who will receive the notification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Category/Type of notification',
    enum: NotificationType,
    example: NotificationType.SERVICE_REQUEST_UPDATE,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Short, descriptive title',
    example: 'Service Request Accepted',
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Detailed notification body text',
    example: 'Your service request #REQ-10023 has been accepted and scheduled for tomorrow.',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Optional action button label',
    example: 'View Request',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ctaLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional redirect URL for the CTA',
    example: '/services/requests/REQ-10023',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ctaUrl?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary structured metadata (e.g. orderId, requestId, quotationId)',
    example: { requestId: 'REQ-10023', urgency: 'HIGH' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether to also dispatch an email notification alongside the push/in-app alert',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Priority level for queue processing (1 = Highest/Immediate, 10 = Normal)',
    default: 5,
  })
  @IsOptional()
  priority?: number;
}
