import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserResponseDto {
  @ApiProperty({ example: '2e6d4ef0-71e5-4e1c-8fcb-2cfd4a8c8ed6' })
  id!: string;

  @ApiProperty({ example: 'admin@elitecentralvacuum.com' })
  email!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CUSTOMER })
  role!: UserRole;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '+1-555-100-1000', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: '2026-08-16T10:00:00.000Z', nullable: true })
  emailVerifiedAt!: Date | null;

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

  @ApiPropertyOptional({
    description: 'Auto-saved in secure HttpOnly cookie (cookie name: refreshToken)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;
}
