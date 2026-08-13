import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, Role } from '@prisma/client';
import { getPagination } from 'src/common/utils/pagination';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CreateSubCategoryDto } from '../dto/create-subcategory.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { UpdateSubCategoryDto } from '../dto/update-subcategory.dto';

type Actor = { id: string; role: string };

@Injectable()
export class StoreCategoriesService {
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

  private productInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { id: true, name: true, slug: true } },
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      features: { orderBy: { sortOrder: 'asc' } },
    } satisfies Prisma.ProductInclude;
  }

  createCategory(dto: CreateCategoryDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can create categories');
      }
      const slug = dto.slug ? this.toSlug(dto.slug) : this.toSlug(dto.name);
      return this.prisma.productCategory.create({
        data: {
          name: dto.name.trim(),
          slug,
          parentId: dto.parentId,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    })();
  }

  getCategories(actor?: Actor) {
    const admin = this.isAdmin(actor);
    return this.prisma.productCategory.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: admin ? {} : { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        subCategories: {
          where: admin ? {} : { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  getAdminCategoryTree(actor?: Actor) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can view admin tree');
    return this.getCategories(actor);
  }

  getCategoryById(id: string, actor?: Actor) {
    return (async () => {
      const category = await this.prisma.productCategory.findUnique({
        where: { id },
        include: {
          children: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
          subCategories: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (!this.isAdmin(actor) && !category.isActive) {
        throw new NotFoundException('Category not found');
      }
      return category;
    })();
  }

  updateCategory(id: string, dto: UpdateCategoryDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can update categories');
      }
      await this.getCategoryById(id, actor);
      return this.prisma.productCategory.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.slug ? { slug: this.toSlug(dto.slug) } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    })();
  }

  deleteCategory(id: string, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can delete categories');

      const linkedProducts = await this.prisma.product.count({ where: { categoryId: id } });
      const linkedSubCategories = await this.prisma.productSubCategory.count({ where: { categoryId: id } });
      const linkedChildren = await this.prisma.productCategory.count({ where: { parentId: id } });
      if (linkedProducts > 0 || linkedSubCategories > 0 || linkedChildren > 0) {
        await this.prisma.productCategory.update({ where: { id }, data: { isActive: false } });
        return { message: 'Category deactivated because it has linked records' };
      }
      await this.prisma.productCategory.delete({ where: { id } });
      return { message: 'Category deleted successfully' };
    })();
  }

  createSubCategory(dto: CreateSubCategoryDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) {
        throw new ForbiddenException('Only admin/staff can create subcategories');
      }
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Category not found');

      const slug = dto.slug ? this.toSlug(dto.slug) : this.toSlug(dto.name);
      return this.prisma.productSubCategory.create({
        data: {
          name: dto.name.trim(),
          slug,
          categoryId: dto.categoryId,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    })();
  }

  updateSubCategory(id: string, dto: UpdateSubCategoryDto, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can update subcategories');
      const existing = await this.prisma.productSubCategory.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Subcategory not found');
      if (dto.categoryId) {
        const category = await this.prisma.productCategory.findUnique({ where: { id: dto.categoryId } });
        if (!category) throw new BadRequestException('Category not found');
      }
      return this.prisma.productSubCategory.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.slug ? { slug: this.toSlug(dto.slug) } : {}),
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    })();
  }

  deleteSubCategory(id: string, actor?: Actor) {
    return (async () => {
      if (!this.isAdmin(actor)) throw new ForbiddenException('Only admin/staff can delete subcategories');
      const linkedProducts = await this.prisma.product.count({ where: { subCategoryId: id } });
      if (linkedProducts > 0) {
        await this.prisma.productSubCategory.update({ where: { id }, data: { isActive: false } });
        return { message: 'Subcategory deactivated because it has linked products' };
      }
      await this.prisma.productSubCategory.delete({ where: { id } });
      return { message: 'Subcategory deleted successfully' };
    })();
  }

  getCategoryProducts(id: string, query: ProductListQueryDto, actor?: Actor) {
    return (async () => {
      const category = await this.prisma.productCategory.findUnique({ where: { id }, select: { id: true } });
      if (!category) throw new NotFoundException('Category not found');
      const admin = this.isAdmin(actor);
      const where: Prisma.ProductWhereInput = {
        ...(admin ? {} : { isActive: true, status: ProductStatus.ACTIVE }),
        categoryId: id,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
                { model: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.subCategoryId ? { subCategoryId: query.subCategoryId } : {}),
      };
      const totalItems = await this.prisma.product.count({ where });
      const pagination = getPagination(query.page, query.limit, totalItems);
      const data = await this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: this.productInclude(),
      });
      return { data, meta: pagination.meta };
    })();
  }
}
