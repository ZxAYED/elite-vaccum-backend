import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { extractMultipartJsonPayload } from 'src/common/utils/parseJsonPayload';
import { AddServiceRequestAttachmentDto } from './dto/add-service-request-attachment.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { RejectServiceRequestDto } from './dto/reject-service-request.dto';
import { ServiceRequestListQueryDto } from './dto/service-request-list-query.dto';
import { UpdateServiceRequestStatusDto } from './dto/update-service-request-status.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('Services - Requests & Intake')
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly serviceRequestsService: ServiceRequestsService) {}

  @Post()
  @Public()
  @UseInterceptors(FilesInterceptor('attachments', 10))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Submit customer service intake request with direct file uploads',
    description:
      'Submits an intake service request. Accepts direct image/video/doc file uploads in "attachments" or "files" field, auto-uploads them to Cloudinary, and saves all attributes into the database. Auto-provisions guest customer lead or links authenticated customer account.',
  })
  @ApiResponse({ status: 201, description: 'Service intake request created' })
  async createRequest(
    @Body() rawBody: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
    @CurrentUser() user?: RequestUser | null,
  ) {
    const payload = extractMultipartJsonPayload<CreateServiceRequestDto>(rawBody);
    const dto = plainToInstance(CreateServiceRequestDto, payload);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return this.serviceRequestsService.createRequest(dto, files, user);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'List requests submitted by logged-in customer',
    description: 'Returns all intake and active service requests belonging to the authenticated customer.',
  })
  @ApiResponse({ status: 200, description: 'Customer service request history' })
  async getMyRequests(
    @Query() query: ServiceRequestListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceRequestsService.getMyRequests(query, user);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Searchable & filterable triage list with live KPI badges',
    description:
      'Returns paginated list of all service requests with aggregated counts (submitted, underReview, accepted, rejected, scheduled).',
  })
  @ApiResponse({ status: 200, description: 'Admin service request triage list with KPIs' })
  async getAdminRequests(@Query() query: ServiceRequestListQueryDto) {
    return this.serviceRequestsService.getAdminRequests(query);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get full service request details by UUID or REQ-XXXXX business ID',
    description: 'Returns equipment, attachments, schedule snapshot, and appointment history.',
  })
  @ApiResponse({ status: 200, description: 'Service request details' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getRequestDetails(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser | null,
  ) {
    return this.serviceRequestsService.getRequestDetails(id, user);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Transition service request status',
    description: 'Transitions status to UNDER_REVIEW, ACCEPTED, etc.',
  })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceRequestsService.updateStatus(id, dto, user);
  }

  @Post(':id/reject')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Reject service request with reason and comments',
    description: 'Transitions status to REJECTED and records an audit note in ServiceRequestRejection.',
  })
  @ApiResponse({ status: 200, description: 'Service request rejected' })
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectServiceRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceRequestsService.rejectRequest(id, dto, user);
  }

  @Post(':id/attachments')
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FilesInterceptor('attachments', 10))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Append media attachments or upload files directly to an active service request',
    description: 'Upload and attach photos, videos, or documents directly to Cloudinary and attach to service request.',
  })
  @ApiResponse({ status: 200, description: 'Attachments added successfully' })
  async addAttachments(
    @Param('id') id: string,
    @Body() rawBody: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
    @CurrentUser() user?: RequestUser | null,
  ) {
    const payload = extractMultipartJsonPayload<AddServiceRequestAttachmentDto>(rawBody);
    const dto = plainToInstance(AddServiceRequestAttachmentDto, payload);
    return this.serviceRequestsService.addAttachments(id, dto, files, user);
  }
}
