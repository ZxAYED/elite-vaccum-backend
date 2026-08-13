import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderListQueryDto } from '../dto/order-list-query.dto';
import { UpdateOrderNotesDto } from '../dto/update-order-notes.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { StoreOrdersService } from './orders.service';

@ApiTags('Store - Orders')
@ApiBearerAuth('bearer')
@Controller()
export class StoreOrdersController {
  constructor(private readonly ordersService: StoreOrdersService) {}

  @Post('orders')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Create order from cart (customer only)' })
  createOrder(@Body() dto: CreateOrderDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.ordersService.createOrderFromCart(dto, req?.user);
  }

  @Get('orders')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get own order history (customer only)' })
  getOrders(@Query() query: OrderListQueryDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.ordersService.getMyOrders(query, req?.user);
  }

  @Get('orders/admin/list')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Get full order list (admin/staff)' })
  getAdminOrders(@Query() query: OrderListQueryDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.ordersService.getAdminOrders(query, req?.user);
  }

  @Get('orders/:id')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Get order details (role-aware)' })
  getOrderById(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.ordersService.getOrderDetails(id, req?.user);
  }

  @Patch('orders/:id/cancel')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Cancel order (customer/admin role-aware)' })
  cancelOrder(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.ordersService.cancelOrder(id, req?.user);
  }

  @Patch('orders/:id/status')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update order status (admin/staff)' })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.ordersService.updateOrderStatus(id, dto, req?.user);
  }

  @Patch('orders/:id/notes')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update order notes (admin/staff)' })
  updateOrderNotes(
    @Param('id') id: string,
    @Body() dto: UpdateOrderNotesDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.ordersService.updateOrderNotes(id, dto, req?.user);
  }
}

