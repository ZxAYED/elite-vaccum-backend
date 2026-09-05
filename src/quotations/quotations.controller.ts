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
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateQuotationDto, CreateQuotationForServiceDto } from './dto/create-quotation.dto';
import {
  QuotationListQueryDto,
  RejectQuotationDto,
  UpdateQuotationDto,
  UpdateQuotationStatusDto,
} from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('Service Operations - Quotations')
@ApiBearerAuth('JWT-auth')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'List quotations (Unified 2-in-1 API for Customer & Admin)' })
  @ApiResponse({ status: 200, description: 'List of quotations' })
  async findAll(
    @Query() query: QuotationListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (user?.role === 'ADMIN') {
      return this.quotationsService.findAll(query);
    }
    return this.quotationsService.getMyQuotations(query, user);
  }

  @Get('me')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: List quotations received by logged-in customer' })
  @ApiResponse({ status: 200, description: 'Customer quotations list' })
  async getMyQuotations(
    @Query() query: QuotationListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.getMyQuotations(query, user);
  }

  @Get('service-request/:serviceRequestId')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Fetch quotation by service request ID (active quote + history)' })
  @ApiResponse({ status: 200, description: 'Quotation for specific service request' })
  async getByServiceRequest(
    @Param('serviceRequestId') serviceRequestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.getByServiceRequest(serviceRequestId, user);
  }

  @Post('service-request/:serviceRequestId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Create itemized quotation directly for a service request',
    description: 'Enforces only 1 active quotation at a time. If an existing quote was rejected or expired, lets admin create another.',
  })
  @ApiResponse({ status: 201, description: 'Quotation created successfully' })
  async createForServiceRequest(
    @Param('serviceRequestId') serviceRequestId: string,
    @Body() dto: CreateQuotationForServiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.create(dto as CreateQuotationDto, user, serviceRequestId);
  }

  @Patch('service-request/:serviceRequestId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Modify or revise the quotation for a service request',
    description: 'Allows admin to edit line items, notes, terms, and discounts before customer accepts or rejects. Accepted or rejected quotations are locked and cannot be modified.',
  })
  @ApiResponse({ status: 200, description: 'Quotation revised successfully' })
  async updateForServiceRequest(
    @Param('serviceRequestId') serviceRequestId: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.updateByServiceRequest(serviceRequestId, dto, user);
  }

  @Delete('service-request/:serviceRequestId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete the quotation for a service request' })
  @ApiResponse({ status: 200, description: 'Quotation deleted successfully' })
  async deleteForServiceRequest(
    @Param('serviceRequestId') serviceRequestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.deleteByServiceRequest(serviceRequestId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quotation details by UUID or QUO-XXXXX business ID' })
  @ApiResponse({ status: 200, description: 'Quotation details' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser | null,
  ) {
    return this.quotationsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: Create itemized quotation for a service request (auto-sent to customer)',
    description: 'Creates itemized quotation, sets status to SENT, updates service request status to QUOTED, and auto-dispatches email notification to customer. Enforces 1 active quotation at a time.',
  })
  @ApiResponse({ status: 201, description: 'Quotation created and sent to customer' })
  async create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Revise or modify quotation details and line items' })
  @ApiResponse({ status: 200, description: 'Quotation revised' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete a quotation and roll back request status' })
  @ApiResponse({ status: 200, description: 'Quotation deleted successfully' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.delete(id, user);
  }

  @Patch(':id/status')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Customer Only: Update quotation status (ACCEPT or REJECT via action enum in body)',
    description: 'Single unified endpoint for customers to either accept (auto-provisions Service Order) or reject a quotation.',
  })
  @ApiResponse({ status: 200, description: 'Quotation status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.updateStatus(id, dto, user);
  }

  @Post(':id/accept')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Customer Only: Accept quotation and generate Stripe Checkout URL',
    description:
      'Only the customer who received this quotation can accept it. Transitions status to ACCEPTED and returns Stripe Checkout URL. The Service Order and Invoice are automatically generated upon successful payment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Quotation accepted and Stripe checkout session URL returned',
  })
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.accept(id, user);
  }

  @Get(':id/checkout-session')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Customer Only: Get or regenerate Stripe checkout session for an accepted quotation',
    description: 'Retrieves existing or generates a new Stripe Checkout Session URL for an unpaid accepted quotation.',
  })
  @ApiResponse({ status: 200, description: 'Stripe checkout session URL returned' })
  async getCheckoutSession(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.getCheckoutSession(id, user);
  }

  @Post(':id/confirm-payment')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({
    summary: 'Confirm mock payment in development / testing mode',
    description:
      'Directly fulfills payment for an accepted quotation and creates the Service Order and Invoice. Useful for preview/mock testing without Stripe webhooks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment fulfilled, Service Order and Invoice generated',
  })
  async confirmMockPayment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.confirmMockPayment(id, user);
  }

  @Post(':id/reject')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Customer Only: Reject quotation with reason note',
    description: 'Only the customer who received this quotation can reject it. Transitions status to REJECTED and records audit history.',
  })
  @ApiResponse({ status: 200, description: 'Quotation rejected' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.quotationsService.reject(id, dto, user);
  }
}
