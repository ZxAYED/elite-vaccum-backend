import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @ApiProperty({ example: 'customer@elitecentralvac.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345', description: 'Reset verification code' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value ?? '')))
  @IsString()
  @Length(4, 10)
  otp!: string;

  @ApiProperty({ example: 'NewPass123!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
