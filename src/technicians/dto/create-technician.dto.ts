import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TechnicianStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTechnicianDto {
  @ApiProperty({ example: 'Alex Rivera', description: 'Technician full display name' })
  @IsString()
  @IsNotEmpty()
  readonly displayName!: string;

  @ApiProperty({ example: 'alex.rivera@example.com' })
  @IsEmail()
  @IsNotEmpty()
  readonly email!: string;

  @ApiProperty({ example: '+1-555-111-2222' })
  @IsString()
  @IsNotEmpty()
  readonly phone!: string;

  @ApiPropertyOptional({ example: 'Password123!', default: 'Password123!' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  readonly password?: string = 'Password123!';

  @ApiPropertyOptional({
    enum: TechnicianStatus,
    default: TechnicianStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TechnicianStatus)
  readonly status?: TechnicianStatus = TechnicianStatus.ACTIVE;

  @ApiPropertyOptional({
    example: ['VACUUM_REPAIR', 'LOW_SUCTION_FIX', 'INSTALLATION'],
    description: 'Technician skill specializations',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly specializations?: string[];

  @ApiPropertyOptional({
    example: { monday: '8:00 AM - 6:00 PM', tuesday: '8:00 AM - 6:00 PM' },
  })
  @IsOptional()
  @IsObject()
  readonly defaultAvailability?: Record<string, string>;

  @ApiPropertyOptional({ example: 'Senior certified central vacuum field technician.' })
  @IsOptional()
  @IsString()
  readonly adminNotes?: string;
}
