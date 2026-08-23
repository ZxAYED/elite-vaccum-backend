import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @ApiProperty({
    example: 'c72a7fa8-8924-4f01-a7eb-6237c569ef83',
    description: 'Technician UUID to assign to this appointment',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly technicianId!: string;

  @ApiPropertyOptional({
    example: 'Assigned based on geographic routing optimization.',
    description: 'Optional admin assignment note',
  })
  @IsOptional()
  @IsString()
  readonly adminNote?: string;
}

export class CancelAppointmentDto {
  @ApiProperty({
    example: 'Customer called to cancel due to personal emergency.',
    description: 'Cancellation reason for audit log',
  })
  @IsString()
  @IsNotEmpty()
  readonly reason!: string;
}
