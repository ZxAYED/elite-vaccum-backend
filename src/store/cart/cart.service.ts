import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, Role, TaxMode } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreCartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  addCartItem(dto: AddCartItemDto, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can manage cart');
      }
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, isActive: true, status: true, stockQuantity: true, price: true },
      });
      if (!product || !product.isActive || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException('Product is not available');
      }
      if (product.stockQuantity <= 0) throw new BadRequestException('Product is out of stock');

      const cart = await this.getOrCreateCart(actor.id);
      const existing = await this.prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      });
      const nextQty = (existing?.quantity ?? 0) + dto.quantity;
      if (nextQty > product.stockQuantity) {
        throw new BadRequestException('Requested quantity exceeds available stock');
      }

      if (existing) {
        return this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: nextQty, unitPrice: product.price },
        });
      }
      return this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
          unitPrice: product.price,
        },
      });
    })();
  }

  getCart(actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can view cart');
      }
      const cart = await this.getOrCreateCart(actor.id);
      const detailed = await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  isActive: true,
                  status: true,
                  shippingCost: true,
                  taxable: true,
                  taxRatePercent: true,
                  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!detailed) throw new NotFoundException('Cart not found');

      const items = detailed.items.map((item) => {
        const unit = Number(item.unitPrice);
        const qty = item.quantity;
        const subtotal = unit * qty;
        const shipping = Number(item.product?.shippingCost ?? 0) * qty;
        const tax =
          item.product?.taxable === TaxMode.TAXABLE
            ? (subtotal * Number(item.product.taxRatePercent ?? 0)) / 100
            : 0;
        return {
          id: item.id,
          productId: item.productId,
          quantity: qty,
          unitPrice: unit,
          lineSubtotal: Number(subtotal.toFixed(2)),
          product: {
            id: item.product?.id,
            name: item.product?.name,
            sku: item.product?.sku,
            primaryImage: item.product?.images?.[0]?.url ?? null,
          },
          estimatedShipping: Number(shipping.toFixed(2)),
          estimatedTax: Number(tax.toFixed(2)),
        };
      });

      const cartSubtotal = items.reduce((sum, i) => sum + i.lineSubtotal, 0);
      const estimatedShipping = items.reduce((sum, i) => sum + i.estimatedShipping, 0);
      const estimatedTax = items.reduce((sum, i) => sum + i.estimatedTax, 0);

      return {
        id: detailed.id,
        items,
        summary: {
          itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
          cartSubtotal: Number(cartSubtotal.toFixed(2)),
          estimatedShipping: Number(estimatedShipping.toFixed(2)),
          estimatedTax: Number(estimatedTax.toFixed(2)),
          estimatedTotal: Number((cartSubtotal + estimatedShipping + estimatedTax).toFixed(2)),
        },
      };
    })();
  }

  updateCartItem(itemId: string, dto: UpdateCartItemDto, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can update cart');
      }
      const item = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { cart: true, product: true },
      });
      if (!item || item.cart.userId !== actor.id) throw new NotFoundException('Cart item not found');
      if (!item.product.isActive || item.product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException('Product is not available');
      }
      if (dto.quantity > item.product.stockQuantity) {
        throw new BadRequestException('Requested quantity exceeds available stock');
      }
      return this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity, unitPrice: item.product.price },
      });
    })();
  }

  removeCartItem(itemId: string, actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can update cart');
      }
      const item = await this.prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { cart: true },
      });
      if (!item || item.cart.userId !== actor.id) throw new NotFoundException('Cart item not found');
      await this.prisma.cartItem.delete({ where: { id: itemId } });
      return { message: 'Cart item removed' };
    })();
  }

  clearCart(actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can clear cart');
      }
      const cart = await this.prisma.cart.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!cart) return { message: 'Cart is already empty' };
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      return { message: 'Cart cleared successfully' };
    })();
  }

  cartCount(actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can view cart count');
      }
      const cart = await this.prisma.cart.findUnique({
        where: { userId: actor.id },
        include: { items: { select: { quantity: true } } },
      });
      if (!cart) return { count: 0 };
      return { count: cart.items.reduce((sum, i) => sum + i.quantity, 0) };
    })();
  }

  validateCart(actor?: Actor) {
    return (async () => {
      if (!actor || actor.role !== Role.CUSTOMER) {
        throw new ForbiddenException('Only customer can validate cart');
      }
      const cart = await this.prisma.cart.findUnique({
        where: { userId: actor.id },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, isActive: true, status: true, stockQuantity: true },
              },
            },
          },
        },
      });
      if (!cart) return { valid: true, invalidItems: [] };

      const invalidItems = cart.items
        .map((item) => {
          const product = item.product;
          if (!product || !product.isActive || product.status !== ProductStatus.ACTIVE) {
            return { itemId: item.id, productId: item.productId, reason: 'PRODUCT_INACTIVE' };
          }
          if (product.stockQuantity < item.quantity) {
            return {
              itemId: item.id,
              productId: item.productId,
              reason: 'INSUFFICIENT_STOCK',
              availableStock: product.stockQuantity,
            };
          }
          return null;
        })
        .filter((x) => !!x);

      return {
        valid: invalidItems.length === 0,
        invalidItems,
      };
    })();
  }
}
