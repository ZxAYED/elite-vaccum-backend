import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @ApiProperty({ example: 'customer@elitecentralvac.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345', description: 'Verification OTP code' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value ?? '')))
  @IsString()
  @Length(4, 10)
  otp!: string;
}
