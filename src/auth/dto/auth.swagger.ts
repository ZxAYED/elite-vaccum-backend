import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({ example: '2e6d4ef0-71e5-4e1c-8fcb-2cfd4a8c8ed6' })
  id!: string;

  @ApiProperty({ example: 'admin@elitecentralvacuum.com' })
  email!: string;

  @ApiProperty({ example: 'Elite Admin' })
  fullName!: string;

  @ApiProperty({ enum: Role, example: Role.ADMIN })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: '+1-555-100-1000', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: '+1-555-100-1001', nullable: true })
  cellphone!: string | null;

  @ApiProperty({ example: 'Elite Central Vacuum', nullable: true })
  companyName!: string | null;

  @ApiProperty({ example: true })
  isEmailVerified!: boolean;

  @ApiProperty({ example: '2026-08-16T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-16T10:00:00.000Z' })
  updatedAt!: Date;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}

export class AuthTokensResponseDto {
  @ApiProperty({ type: () => AuthUserResponseDto })
  user!: AuthUserResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;
}
