import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateBusinessProfileDto {
  @ApiPropertyOptional({ example: 'Elite Central Vacuum' })
  @IsOptional()
  @IsString()
  readonly businessName?: string;

  @ApiPropertyOptional({ example: 'zzayediqbalofficial@gmail.com' })
  @IsOptional()
  @IsEmail()
  readonly supportEmail?: string;

  @ApiPropertyOptional({ example: '01902320296' })
  @IsOptional()
  @IsString()
  readonly primaryPhone?: string;

  @ApiPropertyOptional({ example: '+1-555-019-9922' })
  @IsOptional()
  @IsString()
  readonly secondaryPhone?: string;

  @ApiPropertyOptional({ example: '123 Elite Plaza, Wellness Drive' })
  @IsOptional()
  @IsString()
  readonly address?: string;

  @ApiPropertyOptional({ example: 'Greenwich' })
  @IsOptional()
  @IsString()
  readonly city?: string;

  @ApiPropertyOptional({ example: 'CT' })
  @IsOptional()
  @IsString()
  readonly state?: string;

  @ApiPropertyOptional({ example: '06830' })
  @IsOptional()
  @IsString()
  readonly zipCode?: string;

  @ApiPropertyOptional({ example: 'United States' })
  @IsOptional()
  @IsString()
  readonly country?: string;

  @ApiPropertyOptional({ example: 'Service coverage available by request.' })
  @IsOptional()
  @IsString()
  readonly coverageMessage?: string;

  @ApiPropertyOptional({
    example: 'Coverage is reviewed against technician availability, property location, and service type before scheduling is confirmed.',
  })
  @IsOptional()
  @IsString()
  readonly coverageNotes?: string;

  @ApiPropertyOptional({
    example: {
      monday: '8:00 AM - 8:00 PM',
      tuesday: '8:00 AM - 8:00 PM',
      wednesday: '8:00 AM - 6:00 PM',
      thursday: '8:00 AM - 6:00 PM',
      friday: '8:00 AM - 6:00 PM',
      saturday: '9:00 AM - 3:00 PM',
      sunday: 'Closed',
    },
  })
  @IsOptional()
  @IsObject()
  readonly operatingHours?: Record<string, string>;

  @ApiPropertyOptional({
    example: {
      facebook: 'https://facebook.com/elitecentralvac',
      instagram: 'https://instagram.com/elitecentralvac',
      linkedin: 'https://linkedin.com/company/elitecentralvac',
    },
  })
  @IsOptional()
  @IsObject()
  readonly socialLinks?: Record<string, string>;
}
