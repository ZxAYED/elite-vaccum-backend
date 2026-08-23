import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  InvoiceListQueryDto,
  RecordPaymentDto,
  RecordRefundDto,
  UpdateInvoiceDto,
} from './dto/update-invoice.dto';

@ApiTags('Commerce - Billing & Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('billing/invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: List all invoices with filters & KPI counts' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async findAll(@Query() query: InvoiceListQueryDto) {
    return this.billingService.findAll(query);
  }

  @Get('me')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: List own invoices' })
  @ApiResponse({ status: 200, description: 'Customer invoices list' })
  async getMyInvoices(
    @Query() query: InvoiceListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.billingService.getMyInvoices(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details by UUID or INV-XXXXX business ID' })
  @ApiResponse({ status: 200, description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser | null,
  ) {
    return this.billingService.findOne(id, user);
  }

  @Get(':id/html')
  @ApiOperation({ summary: 'Get printable HTML invoice' })
  @Header('Content-Type', 'text/html')
  async getHtml(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user?: RequestUser | null,
  ) {
    const html = await this.billingService.generateHtmlInvoice(id, user);
    res.send(html);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Create a new custom or service invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.billingService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Update invoice line items, dates, notes, status' })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.billingService.update(id, dto, user);
  }

  @Post(':id/payments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Record payment against invoice (Stripe, Cash, Check, Card)' })
  @ApiResponse({ status: 201, description: 'Payment recorded and invoice status updated' })
  async recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.billingService.recordPayment(id, dto, user);
  }

  @Post(':id/refunds')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Record refund against an existing payment' })
  @ApiResponse({ status: 201, description: 'Refund processed' })
  async recordRefund(
    @Param('id') id: string,
    @Body() dto: RecordRefundDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.billingService.recordRefund(id, dto, user);
  }
}
