import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TechnicianStatus, UserStatus } from '@prisma/client';
import { CreateTechnicianDto } from './create-technician.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTechnicianDto extends PartialType(CreateTechnicianDto) {
  @ApiPropertyOptional({ enum: TechnicianStatus })
  @IsOptional()
  @IsEnum(TechnicianStatus)
  status?: TechnicianStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ example: '+1-555-111-9999' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cellphone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAccountDeleted?: boolean;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  userStatus?: UserStatus;
}
