import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Role, ServiceRequestStatus } from '@prisma/client';
import { getPagination } from '../common/utils/pagination';

type Actor = { id: string; role: string };

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private slugify(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async findAll(params: {
    actor?: Actor;
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive';
    categoryId?: string;
    sortBy?: 'name' | 'sortOrder' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const isAdmin = this.isAdmin(params.actor);

    const where = {
      ...(isAdmin
        ? {
            ...(params.status === 'active' ? { isActive: true } : {}),
            ...(params.status === 'inactive' ? { isActive: false } : {}),
          }
        : { isActive: true }),
      ...(params.categoryId ? { serviceCategoryId: params.categoryId } : {}),
    };

    const totalItems = await this.prisma.serviceType.count({ where });
    const pagination = getPagination(params.page, params.limit, totalItems);

    const data = await this.prisma.serviceType.findMany({
      where,
      include: {
        serviceCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            isActive: true,
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: {
        [params.sortBy ?? 'createdAt']: isAdmin
          ? (params.sortOrder ?? 'desc')
          : 'desc',
      },
    });

    if (!isAdmin) {
      return {
        data: data.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          category: item.serviceCategory,
        })),
        meta: pagination.meta,
      };
    }

    return { data, meta: pagination.meta };
  }

  async findOne(id: string, actor?: Actor) {
    const service = await this.prisma.serviceType.findUnique({
      where: { id },
      include: { serviceCategory: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (!this.isAdmin(actor)) {
      if (!service.isActive || !service.serviceCategory.isActive) {
        throw new NotFoundException('Service not found');
      }
      return {
        id: service.id,
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: {
          id: service.serviceCategory.id,
          name: service.serviceCategory.name,
          slug: service.serviceCategory.slug,
          description: service.serviceCategory.description,
        },
      };
    }

    return service;
  }

  async create(dto: CreateServiceDto, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can create services');
    }

    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.serviceCategoryId },
      select: { id: true, isActive: true },
    });

    if (!category) {
      throw new BadRequestException('Invalid service category');
    }

    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);

    return this.prisma.serviceType.create({
      data: {
        serviceCategoryId: dto.serviceCategoryId,
        name: dto.name.trim(),
        slug,
        description: dto.description,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { serviceCategory: true },
    });
  }

  async update(id: string, dto: UpdateServiceDto, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can update services');
    }

    const existing = await this.prisma.serviceType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Service not found');
    }

    return this.prisma.serviceType.update({
      where: { id },
      data: {
        ...(dto.serviceCategoryId
          ? { serviceCategoryId: dto.serviceCategoryId }
          : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.slug ? { slug: this.slugify(dto.slug) } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { serviceCategory: true },
    });
  }

  async remove(id: string, actor?: Actor) {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Only admin can delete services');
    }

    const existing = await this.prisma.serviceType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Service not found');
    }

    const activeLinkedRequests = await this.prisma.serviceRequest.count({
      where: {
        serviceTypeId: id,
        status: {
          in: [
            ServiceRequestStatus.SUBMITTED,
            ServiceRequestStatus.UNDER_REVIEW,
            ServiceRequestStatus.QUOTED,
            ServiceRequestStatus.QUOTATION_ACCEPTED,
            ServiceRequestStatus.SCHEDULED,
            ServiceRequestStatus.IN_PROGRESS,
          ],
        },
      },
    });

    if (activeLinkedRequests > 0) {
      throw new BadRequestException(
        'Service cannot be deleted while active requests exist',
      );
    }

    await this.prisma.serviceType.delete({ where: { id } });

    return { message: 'Service deleted successfully' };
  }
}
