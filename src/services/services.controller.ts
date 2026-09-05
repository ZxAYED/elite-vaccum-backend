import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceListQueryDto } from './dto/service-list-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceCatalogService } from './service-catalog.service';

@ApiTags('Services - Catalog & Admin Management')
@Controller('services')
export class ServicesController {
  constructor(private readonly serviceCatalogService: ServiceCatalogService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List service offerings grouped by category (2-in-1: Public/Customer gets active, Admin gets all)',
    description:
      'Returns services grouped into SERVICE_AND_MAINTENANCE and INSTALLATION with recommended symptom tags and icons.',
  })
  @ApiResponse({ status: 200, description: 'List of categorized service offerings' })
  async getCatalogGrouped(@CurrentUser() user?: RequestUser | null) {
    return this.serviceCatalogService.getCatalogGrouped(user);
  }

  @Get('list/all')
  @Public()
  @ApiOperation({
    summary: 'Flat list of all services (2-in-1 for Customer & Admin with counts and filters)',
    description: 'Returns all services in a flat array with request counts, status, and dynamic backend filters.',
  })
  @ApiResponse({ status: 200, description: 'Flat list of services' })
  async findAll(
    @CurrentUser() user?: RequestUser | null,
    @Query() query?: ServiceListQueryDto,
  ) {
    return this.serviceCatalogService.findAll(user, query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get service offering details by slug or UUID',
    description: 'Returns specific service metadata, description, and available symptom checklist.',
  })
  @ApiResponse({ status: 200, description: 'Service offering details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.serviceCatalogService.getServiceBySlug(slug);
  }

  @Post()
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Admin: Create a new service offering',
    description: 'Creates a custom central vacuum service offering and syncs to catalog.',
  })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  async createService(
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceCatalogService.createService(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Admin: Update an existing service offering',
    description: 'Updates service metadata, category, description, iconKey, sortOrder, or status (ACTIVE/INACTIVE).',
  })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  async updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceCatalogService.updateService(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Admin: Delete or deactivate a service offering',
    description: 'Permanently deletes if no service requests reference it, or deactivates to INACTIVE to preserve request history.',
  })
  @ApiResponse({ status: 200, description: 'Service deleted or deactivated successfully' })
  async deleteService(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceCatalogService.deleteService(id, user);
  }
}
