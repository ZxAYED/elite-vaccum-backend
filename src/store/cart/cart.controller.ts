import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';
import { StoreCartService } from './cart.service';

@ApiTags('Store - Cart')
@ApiBearerAuth('bearer')
@Controller()
export class StoreCartController {
  constructor(private readonly cartService: StoreCartService) {}

  @Post('cart/items')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Add item to customer cart' })
  addCartItem(@Body() dto: AddCartItemDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.addCartItem(dto, req?.user);
  }

  @Get('cart')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get own cart' })
  getCart(@Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.getCart(req?.user);
  }

  @Patch('cart/items/:itemId')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateCartItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.cartService.updateCartItem(itemId, dto, req?.user);
  }

  @Delete('cart/items/:itemId')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Remove one cart item' })
  removeCartItem(@Param('itemId') itemId: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.removeCartItem(itemId, req?.user);
  }

  @Delete('cart')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.clearCart(req?.user);
  }

  @Get('cart/count')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get cart total item count' })
  cartCount(@Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.cartCount(req?.user);
  }

  @Post('cart/validate')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Validate cart stock/availability' })
  validateCart(@Req() req?: { user?: { id: string; role: string } }) {
    return this.cartService.validateCart(req?.user);
  }
}

