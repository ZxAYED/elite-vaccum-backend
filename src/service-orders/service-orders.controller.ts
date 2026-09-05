import {
  Body,
  Controller,
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
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import {
  AssignServiceOrderTechnicianDto,
  ServiceOrderListQueryDto,
  UpdateEtaDto,
  UpdateServiceOrderDto,
  UpdateServiceOrderStatusDto,
} from './dto/update-service-order.dto';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('Service Operations - Orders')
@ApiBearerAuth('JWT-auth')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Get()
  @Roles('CUSTOMER', 'ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'List service orders (Unified 2-in-1 API for Customer, Technician & Admin)' })
  @ApiResponse({ status: 200, description: 'List of service orders' })
  async findAll(
    @Query() query: ServiceOrderListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (user?.role === 'ADMIN') {
      return this.serviceOrdersService.findAll(query);
    }
    if (user?.role === 'TECHNICIAN') {
      return this.serviceOrdersService.findAll({ ...query, technicianId: user.id });
    }
    return this.serviceOrdersService.getMyOrders(query, user);
  }

  @Get('me')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: List own service orders' })
  @ApiResponse({ status: 200, description: 'Customer service orders list' })
  async getMyOrders(
    @Query() query: ServiceOrderListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.getMyOrders(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service order details by UUID or SO-XXXXX business ID' })
  @ApiResponse({ status: 200, description: 'Service order details' })
  @ApiResponse({ status: 404, description: 'Service order not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: RequestUser | null,
  ) {
    return this.serviceOrdersService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Create a new service order' })
  @ApiResponse({ status: 201, description: 'Service order created' })
  async create(
    @Body() dto: CreateServiceOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Edit service order details, instructions, total' })
  @ApiResponse({ status: 200, description: 'Service order updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Admin / Technician: Update service order status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateServiceOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.updateStatus(id, dto, user);
  }

  @Post(':id/assign')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Assign or reassign technician to service order' })
  @ApiResponse({ status: 200, description: 'Technician assigned' })
  async assignTechnician(
    @Param('id') id: string,
    @Body() dto: AssignServiceOrderTechnicianDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.assignTechnician(id, dto, user);
  }

  @Post(':id/eta')
  @Roles('ADMIN', 'TECHNICIAN')
  @ApiOperation({ summary: 'Admin / Technician: Update live arrival ETA in minutes' })
  @ApiResponse({ status: 200, description: 'ETA updated' })
  async updateEta(
    @Param('id') id: string,
    @Body() dto: UpdateEtaDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.serviceOrdersService.updateEta(id, dto, user);
  }
}
