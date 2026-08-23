import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorator/rolesDecorator';
import { ServiceCatalogService } from './service-catalog.service';

@ApiTags('Services - Public Catalog')
@Controller('services')
export class ServicesController {
  constructor(private readonly serviceCatalogService: ServiceCatalogService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List all fixed service offerings grouped by category',
    description:
      'Returns the 10 fixed services grouped into SERVICE_AND_MAINTENANCE and INSTALLATION with recommended symptom tags and icons.',
  })
  @ApiResponse({ status: 200, description: 'List of categorized service offerings' })
  async getCatalogGrouped() {
    return this.serviceCatalogService.getCatalogGrouped();
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get service offering details by slug',
    description: 'Returns specific service metadata, description, pricing baseline, and available symptom checklist.',
  })
  @ApiResponse({ status: 200, description: 'Service offering details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.serviceCatalogService.getServiceBySlug(slug);
  }
}
