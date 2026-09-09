import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Insights - Admin Dashboard')
@ApiBearerAuth('JWT-auth')
@Roles('ADMIN')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Admin: Single-call dashboard payload - KPI cards, six-month revenue trend, service distribution, latest requests, and the un-quoted request queue',
  })
  @ApiResponse({ status: 200, description: 'Dashboard payload returned' })
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
