import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestUrgency, ServiceRequestStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateServiceRequestStatusDto {
  @ApiProperty({
    enum: ServiceRequestStatus,
    example: ServiceRequestStatus.UNDER_REVIEW,
    description: 'Target service request status',
  })
  @IsEnum(ServiceRequestStatus)
  @IsNotEmpty()
  readonly status!: ServiceRequestStatus;

  @ApiPropertyOptional({
    enum: RequestUrgency,
    example: RequestUrgency.HIGH,
    description: 'Update urgency level: LOW, MEDIUM, HIGH, EMERGENCY',
  })
  @IsOptional()
  @IsEnum(RequestUrgency)
  readonly urgency?: RequestUrgency;

  @ApiPropertyOptional({
    example: 'Request has been reviewed by dispatcher and assigned for preliminary quotation.',
    description: 'Internal transition notes or comments',
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}
