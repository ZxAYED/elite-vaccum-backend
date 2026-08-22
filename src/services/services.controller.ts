import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorator/rolesDecorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { ServiceRequestListQueryDto } from './dto/service-request-list-query.dto';
import { ServiceQuotationsService } from './service-quotations.service';
import { CreateServiceQuotationDto } from './dto/create-service-quotation.dto';
import { RejectServiceQuotationDto } from './dto/reject-service-quotation.dto';
import { ServiceSchedulesService } from './service-schedules.service';
import { CreateServiceScheduleDto } from './dto/create-service-schedule.dto';
import { UpdateServiceScheduleDto } from './dto/update-service-schedule.dto';
import { RequestRescheduleDto } from './dto/request-reschedule.dto';

@ApiTags('Services')
@ApiBearerAuth('bearer')
@Controller()
export class ServicesController {
  constructor(
    private readonly serviceCatalogService: ServiceCatalogService,
    private readonly serviceRequestsService: ServiceRequestsService,
    private readonly serviceQuotationsService: ServiceQuotationsService,
    private readonly serviceSchedulesService: ServiceSchedulesService,
  ) {}

  @Get('services')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'View services (admin/customer role-aware)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'sortOrder', 'createdAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAllServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'active' | 'inactive',
    @Query('categoryId') categoryId?: string,
    @Query('sortBy') sortBy?: 'name' | 'sortOrder' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceCatalogService.findAll({
      actor: req?.user,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      categoryId,
      sortBy,
      sortOrder,
    });
  }

  @Get('services/:id')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'View service details (admin/customer role-aware)' })
  findServiceById(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceCatalogService.findOne(id, req?.user);
  }

  @Post('services')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create service (admin only)' })
  @ApiBody({ type: CreateServiceDto })
  createService(
    @Body() createServiceDto: CreateServiceDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceCatalogService.create(createServiceDto, req?.user);
  }

  @Patch('services/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update service (admin only)' })
  @ApiBody({ type: UpdateServiceDto })
  updateService(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceCatalogService.update(id, updateServiceDto, req?.user);
  }

  @Delete('services/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Delete service (admin only)' })
  deleteService(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceCatalogService.remove(id, req?.user);
  }

  @Post('service-requests')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Create service request (customer only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        description: { type: 'string' },
        additionalNotes: { type: 'string' },
        preferredDate: { type: 'string', format: 'date-time' },
        preferredTime: { type: 'string' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['serviceId'],
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10))
  createServiceRequest(
    @Body() dto: CreateServiceRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceRequestsService.create(dto, req?.user, files);
  }

  @Get('service-requests')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'View service requests (role-aware)' })
  findAllServiceRequests(
    @Query() query: ServiceRequestListQueryDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceRequestsService.findAll(query, req?.user);
  }

  @Get('service-requests/:id')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'View service request by id (role-aware)' })
  findServiceRequestById(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceRequestsService.findOne(id, req?.user);
  }

  @Patch('service-requests/:id')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Update service request (role-aware)' })
  @ApiBody({ type: UpdateServiceRequestDto })
  updateServiceRequest(
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceRequestsService.update(id, dto, req?.user);
  }

  @Delete('service-requests/:id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Cancel service request (customer only)' })
  cancelServiceRequest(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceRequestsService.cancel(id, req?.user);
  }

  @Post('service-quotations')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({
    summary: 'Create quotation for a service request (admin only)',
  })
  @ApiBody({ type: CreateServiceQuotationDto })
  createServiceQuotation(
    @Body() dto: CreateServiceQuotationDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceQuotationsService.create(dto, req?.user);
  }

  @Patch('service-quotations/accept/:id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Accept quotation (customer only)' })
  @ApiParam({ name: 'id', type: String })
  acceptServiceQuotation(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceQuotationsService.acceptQuotation(id, req?.user);
  }

  @Patch('service-quotations/reject/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Reject quotation (admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: RejectServiceQuotationDto })
  rejectServiceQuotation(
    @Param('id') id: string,
    @Body() dto: RejectServiceQuotationDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceQuotationsService.rejectQuotation(
      id,
      dto.reason,
      req?.user,
    );
  }

  @Post('service-schedules')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Schedule a service (admin only)' })
  @ApiBody({ type: CreateServiceScheduleDto })
  createServiceSchedule(
    @Body() dto: CreateServiceScheduleDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceSchedulesService.create(dto, req?.user);
  }

  @Patch('service-schedules/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Reschedule/update service schedule (admin only)' })
  @ApiBody({ type: UpdateServiceScheduleDto })
  updateServiceSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateServiceScheduleDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceSchedulesService.update(id, dto, req?.user);
  }

  @Delete('service-schedules/:id')
  @Roles('ADMIN', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel service schedule (admin only)' })
  cancelServiceSchedule(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceSchedulesService.cancel(id, req?.user);
  }

  @Patch('service-schedules/request-reschedule/:id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer requests schedule rescheduling' })
  @ApiBody({ type: RequestRescheduleDto })
  requestReschedule(
    @Param('id') id: string,
    @Body() dto: RequestRescheduleDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.serviceSchedulesService.requestRescheduleByCustomer(
      id,
      dto,
      req?.user,
    );
  }
}
