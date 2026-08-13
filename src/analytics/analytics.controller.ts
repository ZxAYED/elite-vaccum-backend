// import { Controller, Get } from '@nestjs/common';
// import { ApiTags, ApiOperation } from '@nestjs/swagger';
// import { AnalyticsService } from './analytics.service';
// import { Roles } from '../common/decorator/rolesDecorator';

// @ApiTags('Analytics')
// @Roles('ADMIN')
// @Controller('analytics')
// export class AnalyticsController {
//   constructor(private readonly analyticsService: AnalyticsService) {}

//   @Get('dashboard')
//   @ApiOperation({ summary: 'Get dashboard KPI cards' })
//   getDashboardMetrics() {
//     return this.analyticsService.getDashboardMetrics();
//   }

//   @Get('service-distribution')
//   @ApiOperation({ summary: 'Get service distribution pie chart data' })
//   getServiceDistribution() {
//     return this.analyticsService.getServiceDistribution();
//   }

//   @Get('revenue-trend')
//   @ApiOperation({ summary: 'Get revenue trend line chart data' })
//   getRevenueTrend() {
//     return this.analyticsService.getRevenueTrend();
//   }
// }
