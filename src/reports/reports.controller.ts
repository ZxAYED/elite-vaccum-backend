import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
}
