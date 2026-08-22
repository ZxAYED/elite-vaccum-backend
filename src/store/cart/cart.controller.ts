import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { StoreCartService } from './cart.service';

@ApiTags('Store - Cart')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('store/cart')
export class StoreCartController {
  constructor(private readonly cartService: StoreCartService) {}

  @Post('items')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add item to cart (Customer authentication mandatory)',
  })
  @ApiResponse({
    status: 200,
    description: 'Item added and updated cart returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Product unavailable, out of stock, or quantity exceeds stock',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  addCartItem(
    @Body() dto: AddCartItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cartService.addCartItem(dto, user);
  }

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({
    summary:
      'Get active cart with live line items, product details, stock availability, and full order summary calculation (Customer only)',
  })
  @ApiResponse({ status: 200, description: 'Cart and order summary returned' })
  getCart(@CurrentUser() user: RequestUser) {
    return this.cartService.getCart(user);
  }

  @Patch('items/:itemId')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary:
      'Update quantity of an item in the cart with real-time stock validation (Customer only)',
  })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({
    status: 400,
    description: 'Requested quantity exceeds available inventory',
  })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  updateCartItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cartService.updateCartItem(itemId, dto, user);
  }

  @Delete('items/:itemId')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Remove a specific item from the cart (Customer only)' })
  @ApiResponse({
    status: 200,
    description: 'Item removed and updated cart returned',
  })
  removeCartItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cartService.removeCartItem(itemId, user);
  }

  @Delete()
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all items from the cart (Customer only)' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
  clearCart(@CurrentUser() user: RequestUser) {
    return this.cartService.clearCart(user);
  }

  @Get('count')
  @Roles('CUSTOMER')
  @ApiOperation({
    summary: 'Get total item count for cart icon counter badge (Customer only)',
  })
  @ApiResponse({ status: 200, description: 'Item count returned' })
  cartCount(@CurrentUser() user: RequestUser) {
    return this.cartService.cartCount(user);
  }

  @Post('validate')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pre-checkout validation: Verifies all cart items for active status, stock availability, and price changes (Customer only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result and invalid items report returned',
  })
  validateCart(@CurrentUser() user: RequestUser) {
    return this.cartService.validateCart(user);
  }
}
