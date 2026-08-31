import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  ProductAvailability,
  ProductStatus,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';

@Injectable()
export class StoreCartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves or auto-provisions a Customer profile for an authenticated User.
   */
  private async resolveCustomerId(userId: string): Promise<string> {
    const existing = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const created = await this.prisma.customer.create({
      data: {
        userId: user.id,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        firstName: user.firstName || 'Customer',
        lastName: user.lastName || '',
        email: user.email,
        phone: user.phone || 'N/A',
      },
      select: { id: true },
    });

    return created.id;
  }

  /**
   * Finds or creates a Cart for the authenticated Customer.
   */
  private async getOrCreateCart(user: RequestUser) {
    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication is required to use the shopping cart');
    }

    const customerId = await this.resolveCustomerId(user.id);
    const existing = await this.prisma.cart.findFirst({
      where: { customerId },
    });
    if (existing) return existing;

    return this.prisma.cart.create({
      data: { customerId },
    });
  }

  /**
   * Recalculates and updates the cart subtotal in database.
   */
  private async refreshCartSubtotal(cartId: string): Promise<Prisma.Decimal> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      select: { quantity: true, unitPriceUsd: true },
    });

    const subtotal = items.reduce((sum, item) => {
      return sum.plus(item.unitPriceUsd.mul(item.quantity));
    }, new Prisma.Decimal(0));

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { subtotalUsd: subtotal },
    });

    return subtotal;
  }

  /**
   * Formats the Cart entity with live calculated order summary.
   */
  private formatCartResponse(cart: any) {
    const items = (cart.items || []).map((item: any) => {
      const prod = item.product;
      const isAvailable =
        prod &&
        prod.status === ProductStatus.ACTIVE &&
        prod.category?.status === 'ACTIVE' &&
        prod.quantity >= item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        productName: prod?.name || 'Unknown Product',
        productSku: prod?.sku || null,
        unitPriceUsd: Number(item.unitPriceUsd).toFixed(2),
        quantity: item.quantity,
        totalUsd: (Number(item.unitPriceUsd) * item.quantity).toFixed(2),
        image: prod?.images?.[0]?.url || null,
        availableStock: prod?.quantity ?? 0,
        isAvailable,
        taxable: prod?.taxable ?? true,
      };
    });

    const itemCount = items.reduce((acc: number, i: any) => acc + i.quantity, 0);

    const subtotal = items.reduce(
      (acc: number, i: any) => acc + Number(i.unitPriceUsd) * i.quantity,
      0,
    );

    // Free shipping threshold: $150 or more qualifies for free freight, else $18 standard shipping
    const shippingFee = subtotal >= 150 ? 0.0 : subtotal > 0 ? 18.0 : 0.0;

    // 8% tax calculation on taxable items
    const taxableSubtotal = items
      .filter((i: any) => i.taxable)
      .reduce((acc: number, i: any) => acc + Number(i.unitPriceUsd) * i.quantity, 0);
    const estimatedTax = Number((taxableSubtotal * 0.08).toFixed(2));

    const estimatedTotal = Number((subtotal + shippingFee + estimatedTax).toFixed(2));

    return {
      id: cart.id,
      customerId: cart.customerId,
      items,
      summary: {
        itemCount,
        subtotalUsd: subtotal.toFixed(2),
        shippingFeeUsd: shippingFee.toFixed(2),
        freeShippingThreshold: '150.00',
        qualifiesForFreeShipping: subtotal >= 150,
        amountNeededForFreeShipping:
          subtotal < 150 && subtotal > 0 ? (150 - subtotal).toFixed(2) : '0.00',
        estimatedTaxUsd: estimatedTax.toFixed(2),
        estimatedTotalUsd: estimatedTotal.toFixed(2),
      },
    };
  }


  // CART ACTIONS (CUSTOMER ONLY)


  async addCartItem(dto: AddCartItemDto, user: RequestUser) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { category: { select: { status: true } } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException(`Product '${product.name}' is not currently available for purchase`);
    }

    if (product.category?.status !== 'ACTIVE') {
      throw new BadRequestException(`Product category is currently inactive`);
    }

    if (product.availability === ProductAvailability.OUT_OF_STOCK || product.quantity <= 0) {
      throw new BadRequestException(`Product '${product.name}' is currently out of stock`);
    }

    const cart = await this.getOrCreateCart(user);

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const requestedQuantity = currentQuantity + dto.quantity;

    if (requestedQuantity > product.quantity) {
      throw new BadRequestException(
        `Cannot add ${dto.quantity} unit(s). You already have ${currentQuantity} in your cart, and only ${product.quantity} units are in stock.`,
      );
    }

    if (requestedQuantity > 100) {
      throw new BadRequestException('Maximum allowed order quantity per item is 100 units.');
    }

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        unitPriceUsd: product.priceUsd,
      },
      update: {
        quantity: requestedQuantity,
        unitPriceUsd: product.priceUsd,
      },
    });

    await this.refreshCartSubtotal(cart.id);

    return {
      success: true,
      message: `Added ${product.name} to your cart`,
      cart: await this.getCart(user),
    };
  }

  async getCart(user: RequestUser) {
    const cart = await this.getOrCreateCart(user);

    const fullCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: { select: { status: true } },
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return this.formatCartResponse(fullCart);
  }

  async updateCartItem(
    itemId: string,
    dto: UpdateCartItemDto,
    user: RequestUser,
  ) {
    const cart = await this.getOrCreateCart(user);

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity > item.product.quantity) {
      throw new BadRequestException(
        `Cannot set quantity to ${dto.quantity}. Only ${item.product.quantity} units available in stock.`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        unitPriceUsd: item.product.priceUsd,
      },
    });

    await this.refreshCartSubtotal(cart.id);

    return {
      success: true,
      message: 'Cart item updated',
      cart: await this.getCart(user),
    };
  }

  async removeCartItem(itemId: string, user: RequestUser) {
    const cart = await this.getOrCreateCart(user);

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    await this.refreshCartSubtotal(cart.id);

    return {
      success: true,
      message: 'Item removed from cart',
      cart: await this.getCart(user),
    };
  }

  async clearCart(user: RequestUser) {
    const cart = await this.getOrCreateCart(user);

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { subtotalUsd: new Prisma.Decimal(0) },
    });

    return {
      success: true,
      message: 'Cart cleared successfully',
      cart: await this.getCart(user),
    };
  }

  async cartCount(user: RequestUser) {
    const cart = await this.getOrCreateCart(user);

    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      select: { quantity: true },
    });

    const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);
    return { count: totalCount };
  }

  async validateCart(user: RequestUser) {
    const cartData = await this.getCart(user);
    const unavailableItems: any[] = [];

    for (const item of cartData.items) {
      if (!item.isAvailable) {
        unavailableItems.push({
          itemId: item.id,
          productId: item.productId,
          productName: item.productName,
          reason: item.availableStock < item.quantity
            ? `Requested ${item.quantity} units, but only ${item.availableStock} in stock`
            : 'Product is no longer active or available',
        });
      }
    }

    return {
      isValid: unavailableItems.length === 0,
      itemCount: cartData.summary.itemCount,
      subtotalUsd: cartData.summary.subtotalUsd,
      unavailableItems,
    };
  }
}
