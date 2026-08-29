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
  ApiBody,
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
  @ApiBearerAuth('JWT-auth')
  @ApiBearerAuth('bearer')
  @UseInterceptors(FilesInterceptor('attachments', 10))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Submit customer service intake request with direct file uploads',
    description:
      'Submits an intake service request. In Swagger / Frontend, provide the request JSON in `data` and attach multiple photos/videos/docs in `attachments`. Files are automatically uploaded to Cloudinary.',
  })
  @ApiBody({
    description: 'Service intake request with direct Cloudinary file attachments',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string of CreateServiceRequestDto',
          example: JSON.stringify(
            {
              serviceSlug: 'vacuum-repair',
              fullName: 'Jane Doe',
              email: 'customer@elitecentralvac.com',
              phone: '+1-555-234-5678',
              address: '742 Evergreen Terrace',
              city: 'Springfield',
              state: 'OR',
              zipCode: '97477',
              problemLocation: 'Basement & 2nd Floor',
              preferredDate: '2026-09-15',
              timeWindow: '09:00 AM - 11:00 AM',
              problemDescription:
                'The central vacuum has almost zero suction upstairs and emits a high pitched whistle.',
              symptoms: ['LOW_SUCTION', 'NOISE'],
              manufacturer: 'Beam / Electrolux',
              modelNumber: 'Serenity SC375',
              serialNumber: 'SN-98234-X',
              unitLocation: 'Attached Garage Wall',
              additionalNotes:
                'Gate code is #4321. Friendly dog in the backyard.',
            },
            null,
            2,
          ),
        },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Upload multiple photo/video/doc attachments to Cloudinary',
        },
      },
    },
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
  @ApiBody({
    description: 'Upload files directly to Cloudinary and attach to service request',
    schema: {
      type: 'object',
      properties: {
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Directly upload files (photos, videos, docs) to Cloudinary',
        },
        data: {
          type: 'string',
          description: 'Optional JSON metadata for attachments',
          example: '{"attachments": []}',
        },
      },
    },
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
