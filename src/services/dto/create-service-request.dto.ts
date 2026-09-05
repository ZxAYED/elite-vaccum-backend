import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentKind, RequestSymptom, RequestUrgency } from '@prisma/client';
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

const SYMPTOM_LABEL_MAP: Record<string, RequestSymptom> = {
  'unit not turning on': RequestSymptom.UNIT_NOT_TURNING_ON,
  'unit_not_turning_on': RequestSymptom.UNIT_NOT_TURNING_ON,
  'unit does not shut off': RequestSymptom.UNIT_DOES_NOT_SHUT_OFF,
  'unit_does_not_shut_off': RequestSymptom.UNIT_DOES_NOT_SHUT_OFF,
  'clogged': RequestSymptom.CLOGGED,
  'low suction': RequestSymptom.LOW_SUCTION,
  'low_suction': RequestSymptom.LOW_SUCTION,
  'wall or power hose problem': RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
  'wall_or_power_hose_problem': RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
  'retractable hose problem': RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
  'power hose problem': RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
  'hose problem': RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
  'broken inlet': RequestSymptom.BROKEN_INLET,
  'broken_inlet': RequestSymptom.BROKEN_INLET,
  'noise': RequestSymptom.NOISE,
  'other': RequestSymptom.OTHER,
};

export function normalizeSymptom(input: any): RequestSymptom {
  if (!input || typeof input !== 'string') return RequestSymptom.OTHER;
  const key = input.trim().toLowerCase();
  if (SYMPTOM_LABEL_MAP[key]) return SYMPTOM_LABEL_MAP[key];

  const formatted = input
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_') as RequestSymptom;
  if (Object.values(RequestSymptom).includes(formatted)) {
    return formatted;
  }
  return RequestSymptom.OTHER;
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

  @ApiPropertyOptional({
    example: 'customer@elitecentralvac.com',
    description: 'Customer email (auto-populated from JWT token if logged in)',
  })
  @IsOptional()
  @IsEmail()
  readonly email?: string;

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

  @ApiPropertyOptional({
    example: 'Attic or crawlspace',
    description: 'Custom problem location if "Other" was selected in problemLocation',
  })
  @IsOptional()
  @IsString()
  readonly otherProblemLocation?: string;

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
  @MinLength(1)
  @MaxLength(3000)
  readonly problemDescription!: string;

  @ApiPropertyOptional({
    enum: RequestSymptom,
    isArray: true,
    example: [RequestSymptom.LOW_SUCTION, RequestSymptom.NOISE],
    description: 'Selected symptom tags',
  })
  @IsOptional()
  @Transform(({ value }) => {
    const raw = typeof value === 'string' ? safeJsonParse(value) : value;
    if (!Array.isArray(raw)) {
      if (typeof raw === 'string') return [normalizeSymptom(raw)];
      return [];
    }
    return raw.map((item) => normalizeSymptom(item));
  })
  @IsArray()
  @IsEnum(RequestSymptom, { each: true })
  readonly symptoms?: RequestSymptom[];

  @ApiPropertyOptional({
    enum: RequestUrgency,
    example: RequestUrgency.MEDIUM,
    description: 'Urgency level for this request: LOW, MEDIUM, HIGH, EMERGENCY (Default: MEDIUM)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || typeof value !== 'string') return RequestUrgency.MEDIUM;
    const formatted = value.trim().toUpperCase() as RequestUrgency;
    if (Object.values(RequestUrgency).includes(formatted)) {
      return formatted;
    }
    return RequestUrgency.MEDIUM;
  })
  @IsEnum(RequestUrgency)
  readonly urgency?: RequestUrgency;

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
