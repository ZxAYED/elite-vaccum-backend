import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestSymptom, ServiceCatalogStatus, ServiceGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Commercial Vacuum Maintenance', description: 'Display title of the service' })
  @IsString()
  @IsNotEmpty()
  readonly title!: string;

  @ApiPropertyOptional({ example: 'commercial-vacuum-maintenance', description: 'URL slug (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  readonly slug?: string;

  @ApiProperty({
    enum: ServiceGroup,
    example: ServiceGroup.SERVICE_AND_MAINTENANCE,
    description: 'Category group for the service',
  })
  @IsEnum(ServiceGroup)
  readonly group!: ServiceGroup;

  @ApiProperty({
    example: 'Comprehensive maintenance for commercial and industrial central vacuum facilities.',
    description: 'Short 1-2 sentence summary for catalog cards',
  })
  @IsString()
  @IsNotEmpty()
  readonly summary!: string;

  @ApiProperty({
    example: 'Full multi-point system inspection, piping line vacuum seal tests, filter cleaning, and motor amperage validation.',
    description: 'Detailed service description for service details page',
  })
  @IsString()
  @IsNotEmpty()
  readonly description!: string;

  @ApiPropertyOptional({ example: 'Wrench', default: 'Wrench', description: 'Lucide icon key for UI rendering' })
  @IsOptional()
  @IsString()
  readonly iconKey?: string = 'Wrench';

  @ApiPropertyOptional({ example: 5, default: 0, description: 'Display sort order priority' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly sortOrder?: number = 0;

  @ApiPropertyOptional({
    enum: RequestSymptom,
    isArray: true,
    example: [RequestSymptom.LOW_SUCTION, RequestSymptom.NOISE],
    description: 'Recommended symptom tags associated with this service for intake checklist',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RequestSymptom, { each: true })
  readonly recommendedSymptoms?: RequestSymptom[] = [];

  @ApiPropertyOptional({
    enum: ServiceCatalogStatus,
    default: ServiceCatalogStatus.ACTIVE,
    description: 'Catalog listing visibility status',
  })
  @IsOptional()
  @IsEnum(ServiceCatalogStatus)
  readonly status?: ServiceCatalogStatus = ServiceCatalogStatus.ACTIVE;
}
