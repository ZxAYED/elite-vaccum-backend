import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductAvailability,
  ProductStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateUniqueProductSku } from 'src/common/utils/generateSku';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import { S3UploadService } from 'src/storage/s3-upload.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateProductStatusDto } from '../dto/update-product-status.dto';
import { UpdateProductStockDto } from '../dto/update-product-stock.dto';

@Injectable()
export class StoreProductsService {
  private readonly logger = new Logger(StoreProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3UploadService,
    private readonly redis: RedisService,
  ) {}

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  private productInclude() {
    return {
      category: {
        select: { id: true, name: true, slug: true, status: true },
      },
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      },
      highlights: {
        orderBy: { sortOrder: 'asc' },
      },
      specifications: {
        orderBy: { sortOrder: 'asc' },
      },
      shippingNotes: {
        orderBy: { sortOrder: 'asc' },
      },
      _count: {
        select: {
          reviews: true,
          orderItems: true,
        },
      },
    } satisfies Prisma.ProductInclude;
  }

  private calculateStockAvailability(
    quantity: number,
    currentAvailability?: ProductAvailability,
  ): ProductAvailability {
    if (
      currentAvailability === ProductAvailability.BACKORDER ||
      currentAvailability === ProductAvailability.DISCONTINUED
    ) {
      return currentAvailability;
    }
    if (quantity <= 0) {
      return ProductAvailability.OUT_OF_STOCK;
    }
    if (quantity <= 5) {
      return ProductAvailability.LOW_STOCK;
    }
    return ProductAvailability.IN_STOCK;
  }

  private parsePriceRange(priceRange?: string): {
    min?: number;
    max?: number;
  } | null {
    if (!priceRange) return null;
    const normalized = priceRange.trim().toLowerCase();

    switch (normalized) {
      case 'under_50':
      case '0-50':
      case '0_50':
        return { min: 0, max: 50 };
      case '50-150':
      case '50_150':
        return { min: 50, max: 150 };
      case '150-300':
      case '150_300':
        return { min: 150, max: 300 };
      case '300+':
      case '300_plus':
        return { min: 300 };
      case '0-100':
      case '0_100':
        return { min: 0, max: 100 };
      case '101-500':
      case '101_500':
        return { min: 101, max: 500 };
      case '501-1000':
      case '501_1000':
        return { min: 501, max: 1000 };
      case '1000+':
      case '1000_plus':
        return { min: 1000 };
      default:
        return null;
    }
  }

  async createProduct(
    dto: CreateProductDto,
    files?: Array<Express.Multer.File>,
    user?: RequestUser | null,
  ) {
    // 1. Verify Category exists and is active
    const category = await this.prisma.productCategory.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, status: true },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID '${dto.categoryId}' not found`,
      );
    }

    // 2. Auto-generate Unique Product SKU
    const sku = await generateUniqueProductSku(this.prisma, dto.name);

    // 3. Process image uploads to S3 if multipart files are passed
    const uploadedImages: Array<{
      key: string;
      url: string;
      alt: string;
      isPrimary: boolean;
      sortOrder: number;
    }> = [];

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await this.s3Service.uploadFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder: 'products',
        });

        uploadedImages.push({
          key: uploaded.key,
          url: uploaded.url,
          alt: dto.imageAlt || `${dto.name} image ${i + 1}`,
          isPrimary: i === 0,
          sortOrder: i,
        });
      }
    }

    // 4. Merge DTO specified images if any
    const existingImages = (dto.images || []).map((img, idx) => ({
      key: img.key || null,
      url: img.url,
      alt: img.alt || dto.imageAlt || `${dto.name} image`,
      isPrimary: img.isPrimary ?? false,
      sortOrder: img.sortOrder ?? uploadedImages.length + idx,
    }));

    const allImages = [...uploadedImages, ...existingImages];

    // Ensure at least one image is marked as primary if images exist
    if (allImages.length > 0 && !allImages.some((img) => img.isPrimary)) {
      allImages[0].isPrimary = true;
    }

    const initialQuantity = dto.quantity ?? 1;
    const initialAvailability =
      dto.availability ||
      this.calculateStockAvailability(initialQuantity);

    // 5. Atomic Creation in Prisma Transaction
    const product = await this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name.trim(),
          model: dto.model?.trim() || null,
          sku,
          summary: dto.summary.trim(),
          description: dto.description.trim(),
          quantity: initialQuantity,
          priceUsd: new Prisma.Decimal(dto.priceUsd),
          status: dto.status || ProductStatus.ACTIVE,
          availability: initialAvailability,
          taxable: dto.taxable ?? true,
          shippingLabel: dto.shippingLabel?.trim() || null,
          popularityRank: dto.popularityRank ?? 0,
          imageAlt: dto.imageAlt?.trim() || `${dto.name} product photo`,
          images:
            allImages.length > 0
              ? {
                  create: allImages.map((img) => ({
                    key: img.key,
                    url: img.url,
                    alt: img.alt,
                    isPrimary: img.isPrimary,
                    sortOrder: img.sortOrder,
                  })),
                }
              : undefined,
          highlights:
            dto.highlights && dto.highlights.length > 0
              ? {
                  create: dto.highlights.map((h, index) => ({
                    text: typeof h === 'string' ? h : h.text,
                    sortOrder:
                      typeof h === 'object' && h.sortOrder !== undefined
                        ? h.sortOrder
                        : index,
                  })),
                }
              : undefined,
          specifications:
            dto.specifications && dto.specifications.length > 0
              ? {
                  create: dto.specifications.map((s, index) => ({
                    label: s.label.trim(),
                    value: s.value.trim(),
                    sortOrder: s.sortOrder ?? index,
                  })),
                }
              : undefined,
          shippingNotes:
            dto.shippingNotes && dto.shippingNotes.length > 0
              ? {
                  create: dto.shippingNotes.map((n, index) => ({
                    text: typeof n === 'string' ? n : n.text,
                    sortOrder:
                      typeof n === 'object' && n.sortOrder !== undefined
                        ? n.sortOrder
                        : index,
                  })),
                }
              : undefined,
        },
        include: this.productInclude(),
      });
    });

    await this.invalidateProductCache(product.id, product.sku);
    return product;
  }

  async listProducts(query: ProductListQueryDto, user?: RequestUser | null) {
    const admin = this.isAdmin(user);

    // Redis Cache for public catalog queries (5 min TTL)
    const cacheKey = !admin
      ? `store:products:list:${crypto.createHash('md5').update(JSON.stringify(query)).digest('hex')}`
      : null;

    if (cacheKey) {
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 1. Status condition: Public users only ever see ACTIVE products in ACTIVE categories
    const statusCondition: Prisma.ProductWhereInput = admin
      ? query.status
        ? { status: query.status }
        : {}
      : {
          status: ProductStatus.ACTIVE,
          category: { status: 'ACTIVE' },
        };

    // 2. Category condition: Supports category UUID, category slug, or query.category
    let categoryCondition: Prisma.ProductWhereInput = {};
    const categoryParam =
      query.category || query.categoryId || query.categorySlug;

    if (categoryParam) {
      if (this.isUuid(categoryParam)) {
        categoryCondition = { categoryId: categoryParam };
      } else {
        categoryCondition = {
          category: {
            slug: { equals: categoryParam, mode: 'insensitive' },
          },
        };
      }
    }

    // 3. Quick Search condition (Name, Model, SKU/Part Number, Summary, Description)
    let searchCondition: Prisma.ProductWhereInput = {};
    if (query.search?.trim()) {
      const term = query.search.trim();
      searchCondition = {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { model: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { summary: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    // 4. Availability condition (All, In Stock, Special Order, Out of Stock, or Enum)
    let availabilityCondition: Prisma.ProductWhereInput = {};
    if (query.availability) {
      const avail = query.availability.trim().toLowerCase();
      if (avail === 'in_stock' || avail === 'instock') {
        availabilityCondition = {
          availability: {
            in: [ProductAvailability.IN_STOCK, ProductAvailability.LOW_STOCK],
          },
          quantity: { gt: 0 },
        };
      } else if (
        avail === 'special_order' ||
        avail === 'specialorder' ||
        avail === 'backorder'
      ) {
        availabilityCondition = {
          availability: {
            in: [
              ProductAvailability.BACKORDER,
              ProductAvailability.DISCONTINUED,
            ],
          },
        };
      } else if (avail === 'out_of_stock' || avail === 'outofstock') {
        availabilityCondition = {
          OR: [
            { availability: ProductAvailability.OUT_OF_STOCK },
            { quantity: { lte: 0 } },
          ],
        };
      } else if (avail !== 'all') {
        // Direct Prisma enum match
        const enumKey = Object.values(ProductAvailability).find(
          (k) => k.toLowerCase() === avail,
        );
        if (enumKey) {
          availabilityCondition = { availability: enumKey };
        }
      }
    }

    // 5. Price Range condition (Preset range or Custom min/max)
    let minPrice = query.minPrice;
    let maxPrice = query.maxPrice;

    if (query.priceRange) {
      const preset = this.parsePriceRange(query.priceRange);
      if (preset) {
        if (minPrice === undefined && preset.min !== undefined) {
          minPrice = preset.min;
        }
        if (maxPrice === undefined && preset.max !== undefined) {
          maxPrice = preset.max;
        }
      }
    }

    let priceCondition: Prisma.ProductWhereInput = {};
    if (minPrice !== undefined || maxPrice !== undefined) {
      priceCondition = {
        priceUsd: {
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      };
    }

    // 6. Taxable condition
    const taxableCondition: Prisma.ProductWhereInput =
      query.taxable !== undefined ? { taxable: query.taxable } : {};

    // Combine all where clauses
    const where: Prisma.ProductWhereInput = {
      ...statusCondition,
      ...categoryCondition,
      ...searchCondition,
      ...availabilityCondition,
      ...priceCondition,
      ...taxableCondition,
    };

    // 7. Sorting presets
    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    if (query.sort) {
      const sort = query.sort.trim().toLowerCase();
      if (sort === 'popularity') {
        orderBy = [{ popularityRank: 'desc' }, { createdAt: 'desc' }];
      } else if (sort === 'price_asc' || sort === 'price_low_to_high') {
        orderBy = [{ priceUsd: 'asc' }];
      } else if (sort === 'price_desc' || sort === 'price_high_to_low') {
        orderBy = [{ priceUsd: 'desc' }];
      } else if (sort === 'newest') {
        orderBy = [{ createdAt: 'desc' }];
      } else if (sort === 'name_asc') {
        orderBy = [{ name: 'asc' }];
      } else if (sort === 'name_desc') {
        orderBy = [{ name: 'desc' }];
      }
    }

    if (orderBy.length === 0) {
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      orderBy = [{ [sortBy]: sortOrder }];
    }

    const totalItems = await this.prisma.product.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const items = await this.prisma.product.findMany({
      where,
      skip,
      take,
      orderBy,
      include: this.productInclude(),
    });

    const result = {
      items,
      meta,
    };

    if (cacheKey) {
      await this.redis.set(cacheKey, result, 300); // 5 minutes TTL
    }

    return result;
  }

  async getAdminProducts(
    query: ProductListQueryDto,
    user?: RequestUser | null,
  ) {
    return this.listProducts(
      query,
      user || { id: '', email: '', role: UserRole.ADMIN, isActive: true },
    );
  }

  async getProductById(idOrSku: string, user?: RequestUser | null) {
    const admin = this.isAdmin(user);
    const cacheKey = !admin
      ? `store:products:detail:${idOrSku.toLowerCase().trim()}`
      : null;

    if (cacheKey) {
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const isUuid = this.isUuid(idOrSku);

    const product = await this.prisma.product.findFirst({
      where: isUuid ? { id: idOrSku } : { sku: idOrSku },
      include: this.productInclude(),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Public visitors cannot access draft, archived, or inactive category products
    if (!admin) {
      if (product.status !== ProductStatus.ACTIVE) {
        throw new NotFoundException('Product is not currently available');
      }
      if (product.category.status !== 'ACTIVE') {
        throw new NotFoundException('Product category is not currently available');
      }
    }

    if (cacheKey && product) {
      await this.redis.set(cacheKey, product, 600); // 10 minutes TTL
    }

    return product;
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    files?: Array<Express.Multer.File>,
    user?: RequestUser | null,
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // 1. Delete requested images (from database and AWS S3)
    const imagesToDeleteS3Keys: string[] = [];
    if (dto.deleteImageIds && dto.deleteImageIds.length > 0) {
      const toDelete = existing.images.filter((img) =>
        dto.deleteImageIds?.includes(img.id),
      );
      toDelete.forEach((img) => {
        if (img.key) imagesToDeleteS3Keys.push(img.key);
      });
    }

    // 2. Process newly uploaded files to S3
    const newlyUploadedImages: Array<{
      key: string;
      url: string;
      alt: string;
      isPrimary: boolean;
      sortOrder: number;
    }> = [];

    if (files && files.length > 0) {
      const currentHighestSort = existing.images.reduce(
        (max, img) => Math.max(max, img.sortOrder),
        0,
      );

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await this.s3Service.uploadFile({
          fileBuffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          folder: 'products',
        });

        newlyUploadedImages.push({
          key: uploaded.key,
          url: uploaded.url,
          alt: dto.imageAlt || `${dto.name || existing.name} image`,
          isPrimary:
            existing.images.length === 0 &&
            (!dto.deleteImageIds ||
              dto.deleteImageIds.length === existing.images.length) &&
            i === 0,
          sortOrder: currentHighestSort + 1 + i,
        });
      }
    }

    // Calculate smart availability if quantity changed and availability was not explicitly supplied
    const updatedQuantity = dto.quantity ?? existing.quantity;
    const updatedAvailability =
      dto.availability ??
      (dto.quantity !== undefined
        ? this.calculateStockAvailability(
            updatedQuantity,
            existing.availability,
          )
        : undefined);

    return this.prisma.$transaction(async (tx) => {
      // Delete images from database
      if (dto.deleteImageIds && dto.deleteImageIds.length > 0) {
        await tx.productImage.deleteMany({
          where: {
            id: { in: dto.deleteImageIds },
            productId: id,
          },
        });
      }

      // If highlights array is provided, replace
      if (dto.highlights !== undefined) {
        await tx.productHighlight.deleteMany({ where: { productId: id } });
        if (dto.highlights && dto.highlights.length > 0) {
          await tx.productHighlight.createMany({
            data: dto.highlights.map((h, index) => ({
              productId: id,
              text: typeof h === 'string' ? h : h.text,
              sortOrder:
                typeof h === 'object' && h.sortOrder !== undefined
                  ? h.sortOrder
                  : index,
            })),
          });
        }
      }

      // If specifications array is provided, replace
      if (dto.specifications !== undefined) {
        await tx.productSpecification.deleteMany({ where: { productId: id } });
        if (dto.specifications && dto.specifications.length > 0) {
          await tx.productSpecification.createMany({
            data: dto.specifications.map((s, index) => ({
              productId: id,
              label: s.label.trim(),
              value: s.value.trim(),
              sortOrder: s.sortOrder ?? index,
            })),
          });
        }
      }

      // If shippingNotes array is provided, replace
      if (dto.shippingNotes !== undefined) {
        await tx.productShippingNote.deleteMany({ where: { productId: id } });
        if (dto.shippingNotes && dto.shippingNotes.length > 0) {
          await tx.productShippingNote.createMany({
            data: dto.shippingNotes.map((n, index) => ({
              productId: id,
              text: typeof n === 'string' ? n : n.text,
              sortOrder:
                typeof n === 'object' && n.sortOrder !== undefined
                  ? n.sortOrder
                  : index,
            })),
          });
        }
      }

      // Add newly uploaded images
      if (newlyUploadedImages.length > 0) {
        await tx.productImage.createMany({
          data: newlyUploadedImages.map((img) => ({
            productId: id,
            ...img,
          })),
        });
      }

      // Update product core fields
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.model !== undefined
            ? { model: dto.model?.trim() || null }
            : {}),
          ...(dto.summary ? { summary: dto.summary.trim() } : {}),
          ...(dto.description ? { description: dto.description.trim() } : {}),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
          ...(dto.priceUsd !== undefined
            ? { priceUsd: new Prisma.Decimal(dto.priceUsd) }
            : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(updatedAvailability
            ? { availability: updatedAvailability }
            : {}),
          ...(dto.taxable !== undefined ? { taxable: dto.taxable } : {}),
          ...(dto.shippingLabel !== undefined
            ? { shippingLabel: dto.shippingLabel?.trim() || null }
            : {}),
          ...(dto.popularityRank !== undefined
            ? { popularityRank: dto.popularityRank }
            : {}),
          ...(dto.imageAlt ? { imageAlt: dto.imageAlt.trim() } : {}),
        },
        include: this.productInclude(),
      });

      // Cleanup S3 files asynchronously after DB success
      if (imagesToDeleteS3Keys.length > 0) {
        await this.s3Service.deleteFiles(imagesToDeleteS3Keys);
      }

      await this.invalidateProductCache(updatedProduct.id, updatedProduct.sku);
      return updatedProduct;
    });
  }

  async deleteProductImages(
    productId: string,
    imageIds: string[],
    user?: RequestUser | null,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const imagesToDelete = product.images.filter((img) =>
      imageIds.includes(img.id),
    );

    if (imagesToDelete.length === 0) {
      throw new NotFoundException('No matching images found to delete');
    }

    const deleteIds = imagesToDelete.map((img) => img.id);
    const s3Keys = imagesToDelete
      .map((img) => img.key)
      .filter((k): k is string => Boolean(k));

    await this.prisma.productImage.deleteMany({
      where: {
        id: { in: deleteIds },
        productId,
      },
    });

    if (s3Keys.length > 0) {
      await this.s3Service.deleteFiles(s3Keys);
    }

    await this.invalidateProductCache(productId, product.sku);

    return {
      success: true,
      message: `Successfully deleted ${deleteIds.length} image(s)`,
      deletedIds: deleteIds,
    };
  }

  async deleteProduct(id: string, user?: RequestUser | null) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // If product has already been ordered, archive instead of hard delete to preserve historical receipts
    if (product._count.orderItems > 0) {
      const archived = await this.prisma.product.update({
        where: { id },
        data: {
          status: ProductStatus.ARCHIVED,
          availability: ProductAvailability.DISCONTINUED,
        },
        include: this.productInclude(),
      });

      await this.invalidateProductCache(id, product.sku);

      return {
        success: true,
        message: `Product has existing orders and was safely ARCHIVED instead of hard deleted.`,
        product: archived,
      };
    }

    // Collect all S3 keys for deletion
    const imageKeys = product.images
      .map((img) => img.key)
      .filter((k): k is string => Boolean(k));

    // Delete product from database
    await this.prisma.product.delete({
      where: { id },
    });

    // Delete image files from S3
    if (imageKeys.length > 0) {
      await this.s3Service.deleteFiles(imageKeys);
    }

    await this.invalidateProductCache(id, product.sku);

    return {
      success: true,
      message: `Product '${product.name}' and its images were permanently deleted.`,
    };
  }

  async updateProductStatus(
    id: string,
    dto: UpdateProductStatusDto,
    user?: RequestUser | null,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.availability ? { availability: dto.availability } : {}),
      },
      include: this.productInclude(),
    });

    await this.invalidateProductCache(id, product.sku);
    return updated;
  }

  async updateProductStock(
    id: string,
    dto: UpdateProductStockDto,
    user?: RequestUser | null,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const availability =
      dto.availability ?? this.calculateStockAvailability(dto.quantity);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        quantity: dto.quantity,
        availability,
      },
      include: this.productInclude(),
    });

    await this.invalidateProductCache(id, product.sku);
    return updated;
  }

  /**
   * Helper function for Orders module: Atomically decrements product stock and adjusts availability.
   */
  async decreaseProductStock(
    productId: string,
    quantity: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, quantity: true, availability: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product '${product.name}'. Available: ${product.quantity}, requested: ${quantity}`,
      );
    }

    const newQuantity = product.quantity - quantity;
    const newAvailability = this.calculateStockAvailability(
      newQuantity,
      product.availability,
    );

    const updated = await client.product.update({
      where: { id: productId },
      data: {
        quantity: newQuantity,
        availability: newAvailability,
      },
    });

    await this.invalidateProductCache(productId, product.sku);
    return updated;
  }

  /**
   * Helper function for Orders module: Atomically restores product stock on order cancellation/refund.
   */
  async restoreProductStock(
    productId: string,
    quantity: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, quantity: true, availability: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const newQuantity = product.quantity + quantity;
    const newAvailability = this.calculateStockAvailability(
      newQuantity,
      product.availability,
    );

    const updated = await client.product.update({
      where: { id: productId },
      data: {
        quantity: newQuantity,
        availability: newAvailability,
      },
    });

    await this.invalidateProductCache(productId, product.sku);
    return updated;
  }

  // ==========================================
  // CACHE INVALIDATION HELPER
  // ==========================================

  /**
   * Invalidates Redis cache for product details and public product listings.
   */
  async invalidateProductCache(productId?: string | null, sku?: string | null) {
    try {
      const keysToDelete: string[] = [];
      if (productId) {
        keysToDelete.push(`store:products:detail:${productId.toLowerCase()}`);
      }
      if (sku) {
        keysToDelete.push(`store:products:detail:${sku.toLowerCase()}`);
      }
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
      await this.redis.deleteByPattern('store:products:list:*');
      await this.redis.deleteByPattern('store:categories:*');
    } catch (err: any) {
      this.logger.warn(`Redis product cache invalidation error: ${err.message}`);
    }
  }
}
