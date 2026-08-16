import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'admin@elitecentralvacuum.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Elite Admin' })
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
