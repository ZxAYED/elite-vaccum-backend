import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequestUser,
} from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderListQueryDto } from '../dto/order-list-query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { StoreOrdersService } from './orders.service';

@ApiTags('Store - Orders & Checkout')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('store/orders')
export class StoreOrdersController {
  constructor(private readonly ordersService: StoreOrdersService) {}

  @Post()
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Proceed to order from cart (Customer only): creates ProductOrder, decrements inventory, creates invoice, and returns Stripe Checkout URL (or confirms COD)',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created and Stripe checkout session URL or COD confirmation returned',
  })
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.createOrderFromCart(dto, user);
  }

  @Get('checkout/session/:orderId')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary:
      'Retrieve or regenerate Stripe Checkout Session URL for a pending order',
  })
  @ApiResponse({
    status: 200,
    description: 'Stripe checkout session URL returned',
  })
  getCheckoutSession(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.getCheckoutSession(orderId, user);
  }

  @Post('webhook/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Stripe Webhook handler for checkout.session.completed & payment confirmation',
  })
  handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.ordersService.handleStripeWebhook(payload, signature);
  }

  @Get()
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Get own order history (Customer only)' })
  @ApiResponse({ status: 200, description: 'List of own orders returned' })
  getMyOrders(
    @Query() query: OrderListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.getMyOrders(query, user);
  }

  @Get('admin/list')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get full platform order list with filters (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Admin order list returned' })
  getAdminOrders(
    @Query() query: OrderListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.getAdminOrders(query, user);
  }

  @Get(':id')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({
    summary:
      'Get order details, items, delivery address, timeline, tracking, and invoice by ID or Business ID',
  })
  @ApiResponse({ status: 200, description: 'Order details returned' })
  getOrderById(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.getOrderDetails(id, user);
  }

  @Patch(':id/cancel')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({
    summary:
      'Cancel order: sets status to CANCELLED, voids unpaid invoice, and automatically restores product inventory',
  })
  @ApiResponse({ status: 200, description: 'Order cancelled and inventory restored' })
  cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.cancelOrder(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Unified Admin Update: update order status, carrier, tracking number, and add timeline notes in 1 call (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.updateOrderStatus(id, dto, user);
  }
}
