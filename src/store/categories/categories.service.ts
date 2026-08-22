import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, UserRole } from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryListQueryDto } from '../dto/category-list-query.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class StoreCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: RequestUser | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  private toSlug(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private async generateUniqueCategorySlug(
    name: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.toSlug(name) || 'category';
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.productCategory.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeId) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createCategory(dto: CreateCategoryDto, user?: RequestUser | null) {
    const slug = dto.slug
      ? this.toSlug(dto.slug)
      : await this.generateUniqueCategorySlug(dto.name);

    const slugExists = await this.prisma.productCategory.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (slugExists) {
      throw new ConflictException(`Category slug '${slug}' is already in use`);
    }

    return this.prisma.productCategory.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        status: dto.status?.toUpperCase() || 'ACTIVE',
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        _count: {
          select: {
            products: {
              where: { status: ProductStatus.ACTIVE },
            },
          },
        },
      },
    });
  }

  async getCategories(query: CategoryListQueryDto, user?: RequestUser | null) {
    const admin = this.isAdmin(user);
    const where: Prisma.ProductCategoryWhereInput = {
      ...(admin
        ? query.status
          ? { status: query.status.toUpperCase() }
          : {}
        : { status: 'ACTIVE' }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const totalItems = await this.prisma.productCategory.count({ where });
    const { skip, take, meta } = getPagination(
      query.page,
      query.limit,
      totalItems,
    );

    const orderByField = query.sortBy || 'sortOrder';
    const orderDirection = query.sortOrder || 'asc';

    // Count active products for UI badges (e.g. Central Vacuum Units (12))
    const items = await this.prisma.productCategory.findMany({
      where,
      skip,
      take,
      orderBy: {
        [orderByField]: orderDirection,
      },
      include: {
        _count: {
          select: {
            products: {
              where: admin ? undefined : { status: ProductStatus.ACTIVE },
            },
          },
        },
      },
    });

    // Also calculate the global active products count across all categories for "All categories (32)" badge
    const totalActiveProducts = await this.prisma.product.count({
      where: admin
        ? undefined
        : {
            status: ProductStatus.ACTIVE,
            category: { status: 'ACTIVE' },
          },
    });

    return {
      items,
      totalActiveProducts,
      meta,
    };
  }

  async getCategoryById(idOrSlug: string, user?: RequestUser | null) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );

    const category = await this.prisma.productCategory.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        _count: {
          select: {
            products: {
              where: this.isAdmin(user)
                ? undefined
                : { status: ProductStatus.ACTIVE },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category '${idOrSlug}' not found`);
    }

    if (category.status !== 'ACTIVE' && !this.isAdmin(user)) {
      throw new NotFoundException(`Category '${idOrSlug}' is inactive`);
    }

    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    user?: RequestUser | null,
  ) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = this.toSlug(dto.slug);
      const conflict = await this.prisma.productCategory.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Category slug '${slug}' is already taken`);
      }
    } else if (dto.name && dto.name !== existing.name && !dto.slug) {
      slug = await this.generateUniqueCategorySlug(dto.name, id);
    }

    return this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.status ? { status: dto.status.toUpperCase() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        _count: {
          select: {
            products: {
              where: { status: ProductStatus.ACTIVE },
            },
          },
        },
      },
    });
  }

  async deleteCategory(id: string, user?: RequestUser | null) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    if (existing._count.products > 0) {
      throw new ConflictException(
        `Cannot delete category with ${existing._count.products} associated product(s). Please reassign or delete the products first, or mark category status as INACTIVE.`,
      );
    }

    await this.prisma.productCategory.delete({
      where: { id },
    });

    return {
      success: true,
      message: `Category '${existing.name}' deleted successfully`,
    };
  }
}
