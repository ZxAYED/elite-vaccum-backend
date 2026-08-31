import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Insights - Reports & Analytics')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin: Executive dashboard metrics, revenue over time, service funnel' })
  @ApiResponse({ status: 200, description: 'Overview metrics' })
  async getOverview(@Query() query: ReportsQueryDto) {
    return this.reportsService.getOverview(query);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Admin: Sales volume, top selling products, average order value' })
  @ApiResponse({ status: 200, description: 'Sales report' })
  async getSales(@Query() query: ReportsQueryDto) {
    return this.reportsService.getSales(query);
  }

  @Get('service-operations')
  @ApiOperation({ summary: 'Admin: Service intake volume, top services requested' })
  @ApiResponse({ status: 200, description: 'Service operations report' })
  async getServiceOperations(@Query() query: ReportsQueryDto) {
    return this.reportsService.getServiceOperations(query);
  }

  @Get('technicians')
  @ApiOperation({ summary: 'Admin: Technician leaderboard, ratings, completed jobs' })
  @ApiResponse({ status: 200, description: 'Technician performance report' })
  async getTechnicians() {
    return this.reportsService.getTechnicians();
  }

  @Get('customers')
  @ApiOperation({ summary: 'Admin: Customer growth, active customers, repeat rate' })
  @ApiResponse({ status: 200, description: 'Customer analytics report' })
  async getCustomers() {
    return this.reportsService.getCustomers();
  }

  // ==========================================
  // CSV DATA EXPORT ENDPOINTS
  // ==========================================

  @Get('export/orders/csv')
  @ApiOperation({ summary: 'Admin: Export orders report to CSV format' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="orders_report.csv"')
  async exportOrdersCsv(@Query() query: ReportsQueryDto, @Res() res: Response) {
    const csv = await this.reportsService.exportOrdersCsv(query);
    res.send(csv);
  }

  @Get('export/service-requests/csv')
  @ApiOperation({ summary: 'Admin: Export service requests report to CSV format' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="service_requests_report.csv"')
  async exportServiceRequestsCsv(@Query() query: ReportsQueryDto, @Res() res: Response) {
    const csv = await this.reportsService.exportServiceRequestsCsv(query);
    res.send(csv);
  }

  @Get('export/customers/csv')
  @ApiOperation({ summary: 'Admin: Export customer list to CSV format' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="customers_report.csv"')
  async exportCustomersCsv(@Res() res: Response) {
    const csv = await this.reportsService.exportCustomersCsv();
    res.send(csv);
  }

  @Get('export/invoices/csv')
  @ApiOperation({ summary: 'Admin: Export invoices report to CSV format' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="invoices_report.csv"')
  async exportInvoicesCsv(@Query() query: ReportsQueryDto, @Res() res: Response) {
    const csv = await this.reportsService.exportInvoicesCsv(query);
    res.send(csv);
  }
}

