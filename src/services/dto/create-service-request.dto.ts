import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentKind, RequestSymptom } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { safeJsonParse } from 'src/common/utils/parseJsonPayload';

export class ServiceRequestAttachmentInputDto {
  @ApiProperty({ example: 'damaged-inlet-valve.jpg' })
  @IsString()
  @IsNotEmpty()
  readonly fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsNotEmpty()
  readonly fileType!: string;

  @ApiProperty({ example: 204800, description: 'File size in bytes' })
  @Type(() => Number)
  @IsInt()
  readonly sizeBytes!: number;

  @ApiProperty({ example: 'https://bucket.s3.amazonaws.com/requests/image.jpg' })
  @IsUrl()
  @IsNotEmpty()
  readonly url!: string;

  @ApiProperty({ enum: AttachmentKind, default: AttachmentKind.PHOTO })
  @IsEnum(AttachmentKind)
  readonly kind!: AttachmentKind;

  @ApiPropertyOptional({ example: 'Wall Inlet' })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({ example: 'Photo showing cracked valve latch' })
  @IsOptional()
  @IsString()
  readonly note?: string;
}

export class CreateServiceRequestDto {
  // Service Identity
  @ApiProperty({
    example: 'low-suction-fix',
    description: 'Fixed service catalog slug (e.g. "low-suction-fix", "vacuum-repair", "new-system")',
  })
  @IsString()
  @IsNotEmpty()
  readonly serviceSlug!: string;

  // Customer Information
  @ApiProperty({ example: 'Jane Doe', description: 'Customer full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  readonly fullName!: string;

  @ApiProperty({ example: 'jane.doe@example.com', description: 'Customer email' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ example: '+1 (555) 234-5678', description: 'Customer contact phone number' })
  @IsString()
  @IsNotEmpty()
  readonly phone!: string;

  // Service Location
  @ApiProperty({ example: '742 Evergreen Terrace', description: 'Street address line' })
  @IsString()
  @IsNotEmpty()
  readonly address!: string;

  @ApiProperty({ example: 'Springfield', description: 'City' })
  @IsString()
  @IsNotEmpty()
  readonly city!: string;

  @ApiProperty({ example: 'OR', description: 'State / Province' })
  @IsString()
  @IsNotEmpty()
  readonly state!: string;

  @ApiProperty({ example: '97477', description: 'Zip / Postal code' })
  @IsString()
  @IsNotEmpty()
  readonly zipCode!: string;

  @ApiPropertyOptional({
    example: 'Basement & 2nd Floor',
    description: 'Specific location within the property (e.g. Basement, Garage, Main Level, 2nd Floor)',
  })
  @IsOptional()
  @IsString()
  readonly problemLocation?: string;

  // Requested Schedule
  @ApiProperty({ example: '2026-09-15', description: 'Preferred service date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  readonly preferredDate!: string;

  @ApiProperty({
    example: '09:00 AM - 11:00 AM',
    description: 'Preferred time window (e.g. "09:00 AM - 11:00 AM" or "MORNING")',
  })
  @IsString()
  @IsNotEmpty()
  readonly timeWindow!: string;

  // Tell Us What's Happening
  @ApiProperty({
    example: 'The central vacuum has almost zero suction upstairs and emits a high pitched whistle.',
    description: 'Detailed description of the issue or project requirement',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  readonly problemDescription!: string;

  @ApiPropertyOptional({
    enum: RequestSymptom,
    isArray: true,
    example: [RequestSymptom.LOW_SUCTION, RequestSymptom.NOISE],
    description: 'Selected symptom tags',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? safeJsonParse(value) : value))
  @IsArray()
  @IsEnum(RequestSymptom, { each: true })
  readonly symptoms?: RequestSymptom[];

  // Equipment Information (Optional)
  @ApiPropertyOptional({ example: 'Beam / Electrolux', description: 'Power unit manufacturer' })
  @IsOptional()
  @IsString()
  readonly manufacturer?: string;

  @ApiPropertyOptional({ example: 'Serenity SC375', description: 'Model number' })
  @IsOptional()
  @IsString()
  readonly modelNumber?: string;

  @ApiPropertyOptional({ example: 'SN-98234-X', description: 'Serial number' })
  @IsOptional()
  @IsString()
  readonly serialNumber?: string;

  @ApiPropertyOptional({ example: 'Attached Garage Wall', description: 'Physical unit location' })
  @IsOptional()
  @IsString()
  readonly unitLocation?: string;

  // Photos & Videos
  @ApiPropertyOptional({
    type: [ServiceRequestAttachmentInputDto],
    description:
      'Attached photos, videos, or documents (or upload directly via attachments/files multipart fields)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? safeJsonParse(value) : value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceRequestAttachmentInputDto)
  readonly attachments?: ServiceRequestAttachmentInputDto[];

  // Additional Notes
  @ApiPropertyOptional({
    example: 'Gate code is #4321. Friendly dog in the backyard.',
    description: 'Additional notes or access instructions',
  })
  @IsOptional()
  @IsString()
  readonly additionalNotes?: string;
}
