import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, Role, TaxMode } from '@prisma/client';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddProductImageDto } from '../dto/add-product-image.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateProductImageDto } from '../dto/update-product-image.dto';
import { UpdateProductStatusDto } from '../dto/update-product-status.dto';
import { UpdateProductStockDto } from '../dto/update-product-stock.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private toSlug(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private async generateUniqueSku(name: string) {
    const base = this.toSlug(name).toUpperCase().replace(/-/g, '-').slice(0, 40) || 'PRODUCT';
    for (let i = 0; i < 12; i++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const sku = `${base}-${suffix}`;
      const found = await this.prisma.product.findUnique({ where: { sku }, select: { id: true } });
      if (!found) return sku;
    }
    throw new BadRequestException('Could not generate unique SKU, please retry');
  }

  private productWhere(query: ProductListQueryDto, admin: boolean): Prisma.ProductWhereInput {
    return {
      ...(admin ? {} : { isActive: true, status: ProductStatus.ACTIVE }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subCategoryId ? { subCategoryId: query.subCategoryId } : {}),
      ...(query.taxable ? { taxable: query.taxable } : {}),
      ...(admin && query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(admin && query.status ? { status: query.status } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.stockState === 'inStock' ? { stockQuantity: { gt: 0 } } : {}),
      ...(query.stockState === 'outOfStock' ? { stockQuantity: { lte: 0 } } : {}),
    };
  }

  private productInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { id: true, name: true, slug: true } },
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      features: { orderBy: { sortOrder: 'asc' } },
    } satisfies Prisma.ProductInclude;
  }

  createProduct(dto: CreateProductDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can create products');
      }
      const [category, subCategory] = await Promise.all([
        this.prisma.productCategory.findUnique({ where: { id: dto.categoryId }, select: { id: true } }),
        this.prisma.productSubCategory.findUnique({
          where: { id: dto.subCategoryId },
          select: { id: true, categoryId: true },
        }),
      ]);
      if (!category) throw new BadRequestException('Invalid category');
      if (!subCategory) throw new BadRequestException('Invalid subcategory');
      if (subCategory.categoryId !== dto.categoryId) {
        throw new BadRequestException('Subcategory does not belong to provided category');
      }

      const sku = await this.generateUniqueSku(dto.name);
      const images = dto.images ?? [];
      const hasPrimary = images.some((i) => i.isPrimary);

      return this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          sku,
          categoryId: dto.categoryId,
          subCategoryId: dto.subCategoryId,
          model: dto.model?.trim(),
          shortDescription: dto.shortDescription,
          description: dto.description,
          price: dto.price,
          shippingCost: dto.shippingCost ?? 0,
          taxable: dto.taxable ?? TaxMode.TAXABLE,
          taxRatePercent: dto.taxRatePercent ?? 0,
          stockQuantity: dto.stockQuantity ?? 0,
          shippingWeight: dto.shippingWeight,
          dimensionLength: dto.dimensionLength,
          dimensionWidth: dto.dimensionWidth,
          dimensionHeight: dto.dimensionHeight,
          warrantyInfo: dto.warrantyInfo,
          manualPdfUrl: dto.manualPdfUrl,
          tags: dto.tags ?? [],
          specifications: dto.specifications ?? [],
          status: dto.status ?? ProductStatus.ACTIVE,
          isActive: dto.isActive ?? true,
          images: images.length
            ? {
                create: images.map((image, index) => ({
                  url: image.url,
                  altText: image.altText,
                  sortOrder: image.sortOrder ?? index,
                  isPrimary: hasPrimary ? !!image.isPrimary : index === 0,
                })),
              }
            : undefined,
          features: dto.features?.length
            ? {
                create: dto.features.map((f, index) => ({
                  iconKey: f.iconKey,
                  value: f.value,
                  sortOrder: f.sortOrder ?? index,
                })),
              }
            : undefined,
        },
        include: this.productInclude(),
      });
    })();
  }

  listProducts(query: ProductListQueryDto, actor?: Actor) {
    return (async () => {
      const admin = this.isAdmin(actor);
      const where = this.productWhere(query, admin);
      const totalItems = await this.prisma.product.count({ where });
      const pagination = getPagination(query.page, query.limit, totalItems);
      const sortBy = query.sortBy ?? 'createdAt';
      const sortOrder = query.sortOrder ?? 'desc';

      const data = await this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortBy]: sortOrder },
        include: this.productInclude(),
      });

      return { data, meta: pagination.meta };
    })();
  }

  getAdminProducts(query: ProductListQueryDto, actor?: Actor) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can view admin list');
    return this.listProducts(query, actor);
  }

  getProductById(id: string, actor?: Actor) {
    return (async () => {
      const admin = this.isAdmin(actor);
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: this.productInclude(),
      });
      if (!product) throw new NotFoundException('Product not found');
      if (!admin && (!product.isActive || product.status !== ProductStatus.ACTIVE)) {
        throw new NotFoundException('Product not found');
      }
      return product;
    })();
  }

  updateProduct(id: string, dto: UpdateProductDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update products');
      const existing = await this.prisma.product.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Product not found');

      if (dto.categoryId || dto.subCategoryId) {
        const categoryId = dto.categoryId ?? existing.categoryId;
        const subCategoryId = dto.subCategoryId ?? existing.subCategoryId;
        const subCategory = await this.prisma.productSubCategory.findUnique({
          where: { id: subCategoryId },
          select: { categoryId: true },
        });
        if (!subCategory || subCategory.categoryId !== categoryId) {
          throw new BadRequestException('Subcategory does not belong to selected category');
        }
      }

      return this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.subCategoryId ? { subCategoryId: dto.subCategoryId } : {}),
          ...(dto.model !== undefined ? { model: dto.model?.trim() || null } : {}),
          ...(dto.shortDescription !== undefined ? { shortDescription: dto.shortDescription } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.shippingCost !== undefined ? { shippingCost: dto.shippingCost } : {}),
          ...(dto.taxable ? { taxable: dto.taxable } : {}),
          ...(dto.taxRatePercent !== undefined ? { taxRatePercent: dto.taxRatePercent } : {}),
          ...(dto.stockQuantity !== undefined ? { stockQuantity: dto.stockQuantity } : {}),
          ...(dto.shippingWeight !== undefined ? { shippingWeight: dto.shippingWeight } : {}),
          ...(dto.dimensionLength !== undefined ? { dimensionLength: dto.dimensionLength } : {}),
          ...(dto.dimensionWidth !== undefined ? { dimensionWidth: dto.dimensionWidth } : {}),
          ...(dto.dimensionHeight !== undefined ? { dimensionHeight: dto.dimensionHeight } : {}),
          ...(dto.warrantyInfo !== undefined ? { warrantyInfo: dto.warrantyInfo } : {}),
          ...(dto.manualPdfUrl !== undefined ? { manualPdfUrl: dto.manualPdfUrl } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.specifications !== undefined ? { specifications: dto.specifications } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: this.productInclude(),
      });
    })();
  }

  deleteProduct(id: string, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can delete products');
      const existing = await this.prisma.product.findUnique({
        where: { id },
        select: { id: true, cartItems: { select: { id: true } }, orderItems: { select: { id: true } } },
      });
      if (!existing) throw new NotFoundException('Product not found');
      if (existing.orderItems.length > 0 || existing.cartItems.length > 0) {
        await this.prisma.product.update({
          where: { id },
          data: { isActive: false, status: ProductStatus.INACTIVE },
        });
        return { message: 'Product deactivated because it has references' };
      }
      await this.prisma.product.delete({ where: { id } });
      return { message: 'Product deleted successfully' };
    })();
  }

  updateProductStatus(id: string, dto: UpdateProductStatusDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update status');
      await this.getProductById(id, actor);
      return this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    })();
  }

  updateProductStock(id: string, dto: UpdateProductStockDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update stock');
      await this.getProductById(id, actor);
      return this.prisma.product.update({
        where: { id },
        data: { stockQuantity: dto.stockQuantity },
      });
    })();
  }

  addProductImage(id: string, dto: AddProductImageDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can add product images');
      await this.getProductById(id, actor);
      return this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await tx.productImage.updateMany({
            where: { productId: id, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.productImage.create({
          data: {
            productId: id,
            url: dto.url,
            altText: dto.altText,
            isPrimary: dto.isPrimary ?? false,
            sortOrder: dto.sortOrder ?? 0,
          },
        });
      });
    })();
  }

  updateProductImage(productId: string, imageId: string, dto: UpdateProductImageDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update product images');
      const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
      if (!image || image.productId !== productId) throw new NotFoundException('Product image not found');
      return this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary) {
          await tx.productImage.updateMany({
            where: { productId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.productImage.update({
          where: { id: imageId },
          data: {
            ...(dto.url ? { url: dto.url } : {}),
            ...(dto.altText !== undefined ? { altText: dto.altText } : {}),
            ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          },
        });
      });
    })();
  }

  deleteProductImage(productId: string, imageId: string, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can delete product images');
      const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
      if (!image || image.productId !== productId) throw new NotFoundException('Product image not found');
      await this.prisma.productImage.delete({ where: { id: imageId } });
      return { message: 'Product image removed' };
    })();
  }
}
