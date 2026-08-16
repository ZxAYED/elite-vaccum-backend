import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@elitecentralvacuum.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
