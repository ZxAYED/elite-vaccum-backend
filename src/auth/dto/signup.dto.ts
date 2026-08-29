import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SignupDto {
  @ApiProperty({ example: 'customer@elitecentralvac.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: '+1-555-100-1000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: '+1-555-100-1001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cellphone?: string;

  @ApiPropertyOptional({ example: 'Elite Central Vacuum' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;
}
