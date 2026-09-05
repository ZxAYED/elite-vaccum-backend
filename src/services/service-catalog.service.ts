import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  RequestSymptom,
  ServiceCatalogStatus,
  ServiceGroup,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis';
import {
  FIXED_SERVICES_CATALOG,
  SYMPTOM_DEFINITIONS,
} from './constants/services-catalog.constant';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceListQueryDto } from './dto/service-list-query.dto';

@Injectable()
export class ServiceCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ServiceCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.ensureCatalogSeeded().catch((err) => {
      this.logger.warn(`Failed to auto-seed services catalog: ${err.message}`);
    });
  }

  private isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private formatService(service: any) {
    const offering = service.publicOfferings?.[0];
    const fixed = FIXED_SERVICES_CATALOG.find(
      (f) => f.slug.toLowerCase() === service.slug.toLowerCase(),
    );

    return {
      id: service.id,
      key: fixed?.key || service.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      slug: service.slug,
      group: (offering?.group || service.category || ServiceGroup.SERVICE_AND_MAINTENANCE) as ServiceGroup,
      title: offering?.title || service.name,
      iconKey: offering?.iconKey || 'Wrench',
      summary: offering?.summary || service.description,
      description: offering?.description || service.description,
      sortOrder: offering?.sortOrder ?? 0,
      recommendedSymptoms:
        service.commonIssues && service.commonIssues.length > 0
          ? (service.commonIssues as RequestSymptom[])
          : fixed?.recommendedSymptoms || [],
      status: service.status as ServiceCatalogStatus,
      requestCount: service._count?.serviceRequests ?? 0,
      reviewCount: service._count?.reviews ?? 0,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  private async findServiceEntity(idOrSlug: string) {
    const isUuid = this.isUuid(idOrSlug);
    return this.prisma.service.findFirst({
      where: isUuid
        ? { id: idOrSlug }
        : {
            OR: [
              { slug: idOrSlug.toLowerCase().trim() },
              { publicOfferings: { some: { slug: idOrSlug.toLowerCase().trim() } } },
            ],
          },
      include: {
        publicOfferings: true,
        _count: { select: { serviceRequests: true, reviews: true } },
      },
    });
  }

  /**
   * Returns all services grouped by category (SERVICE_AND_MAINTENANCE vs INSTALLATION).
   * For Customers / Public: Returns only ACTIVE services.
   * For Admins: Returns all services (including INACTIVE / DRAFT).
   */
  async getCatalogGrouped(user?: RequestUser | null) {
    const isAdmin = user?.role === UserRole.ADMIN;
    const cacheKey = `services:catalog:grouped:${isAdmin ? 'admin' : 'public'}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    let dbServices: any[] = [];
    try {
      dbServices = await this.prisma.service.findMany({
        where: isAdmin ? {} : { status: ServiceCatalogStatus.ACTIVE },
        include: {
          publicOfferings: true,
          _count: { select: { serviceRequests: true, reviews: true } },
        },
        orderBy: [{ publicOfferings: { _count: 'desc' } }, { createdAt: 'asc' }],
      });
    } catch {
      // Fallback if DB query fails
    }

    // If DB is empty, use seed catalog
    const allFormatted =
      dbServices.length > 0
        ? dbServices.map((s) => this.formatService(s))
        : FIXED_SERVICES_CATALOG.map((f) => ({
            id: f.slug,
            key: f.key,
            slug: f.slug,
            group: f.group,
            title: f.title,
            iconKey: f.iconKey,
            summary: f.summary,
            description: f.description,
            sortOrder: f.sortOrder,
            recommendedSymptoms: f.recommendedSymptoms,
            status: ServiceCatalogStatus.ACTIVE,
            requestCount: 0,
            reviewCount: 0,
          }));

    const serviceAndMaintenance = allFormatted
      .filter((s) => s.group === ServiceGroup.SERVICE_AND_MAINTENANCE)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const installation = allFormatted
      .filter((s) => s.group === ServiceGroup.INSTALLATION)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const result = {
      success: true,
      data: {
        serviceAndMaintenance,
        installation,
        symptoms: SYMPTOM_DEFINITIONS,
      },
      meta: {
        totalServices: allFormatted.length,
        groups: [
          {
            key: ServiceGroup.SERVICE_AND_MAINTENANCE,
            title: 'Service & Maintenance',
            count: serviceAndMaintenance.length,
          },
          {
            key: ServiceGroup.INSTALLATION,
            title: 'Installation Services',
            count: installation.length,
          },
        ],
      },
    };

    await this.redis.set(cacheKey, result, 3600); // 1 hour TTL
    return result;
  }

  /**
   * Flat list of all services (2-in-1 endpoint).
   * For Admins: Returns all with KPI metrics and inactive status.
   * For Customers/Public: Returns all active services.
   */
  async findAll(user?: RequestUser | null, query?: ServiceListQueryDto) {
    const isAdmin = user?.role === UserRole.ADMIN;

    const where: any = {};
    if (!isAdmin) {
      where.status = ServiceCatalogStatus.ACTIVE;
    } else if (query?.status && query.status !== 'all') {
      where.status = query.status as ServiceCatalogStatus;
    }

    if (query?.group && query.group !== 'all') {
      const g = query.group.toUpperCase();
      where.OR = [
        { category: query.group },
        { category: g },
        { publicOfferings: { some: { group: g as ServiceGroup } } },
      ];
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: s, mode: 'insensitive' } },
            { slug: { contains: s, mode: 'insensitive' } },
            { description: { contains: s, mode: 'insensitive' } },
          ],
        },
      ];
    }

    let orderBy: any = { createdAt: 'asc' };
    if (query?.sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (query?.sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (query?.sort === 'name-asc') {
      orderBy = { name: 'asc' };
    } else if (query?.sort === 'name-desc') {
      orderBy = { name: 'desc' };
    }

    let dbServices: any[] = [];
    try {
      dbServices = await this.prisma.service.findMany({
        where,
        include: {
          publicOfferings: true,
          _count: { select: { serviceRequests: true, reviews: true } },
        },
        orderBy,
      });
    } catch (err: any) {
      this.logger.warn(`Failed querying services with filters: ${err.message}`);
    }

    let items =
      dbServices.length > 0
        ? dbServices.map((s) => this.formatService(s))
        : FIXED_SERVICES_CATALOG.map((f) => ({
            id: f.slug,
            key: f.key,
            slug: f.slug,
            group: f.group,
            title: f.title,
            iconKey: f.iconKey,
            summary: f.summary,
            description: f.description,
            sortOrder: f.sortOrder,
            recommendedSymptoms: f.recommendedSymptoms,
            status: ServiceCatalogStatus.ACTIVE,
            requestCount: 0,
            reviewCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

    if (dbServices.length === 0) {
      if (query?.status && query.status !== 'all') {
        items = items.filter((item) => item.status === query.status);
      }
      if (query?.group && query.group !== 'all') {
        items = items.filter((item) => item.group === query.group);
      }
      if (query?.search && query.search.trim()) {
        const s = query.search.trim().toLowerCase();
        items = items.filter(
          (item) =>
            item.title.toLowerCase().includes(s) ||
            item.slug.toLowerCase().includes(s) ||
            item.description.toLowerCase().includes(s),
        );
      }
      if (query?.sort === 'name-asc') {
        items = items.sort((a, b) => a.title.localeCompare(b.title));
      } else if (query?.sort === 'name-desc') {
        items = items.sort((a, b) => b.title.localeCompare(a.title));
      }
    }

    if (query?.sort === 'display-order') {
      items = items.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    }

    return {
      success: true,
      items,
      total: items.length,
    };
  }

  /**
   * Retrieves specific service metadata by slug or UUID.
   */
  async getServiceBySlug(idOrSlug: string) {
    const cleanIdentifier = idOrSlug.toLowerCase().trim();
    const cacheKey = `services:catalog:slug:${cleanIdentifier}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const dbRecord = await this.findServiceEntity(idOrSlug).catch(() => null);

    if (dbRecord) {
      const formatted = this.formatService(dbRecord);
      const result = {
        success: true,
        data: {
          ...formatted,
          symptoms: SYMPTOM_DEFINITIONS,
        },
      };
      await this.redis.set(cacheKey, result, 3600);
      return result;
    }

    // Fallback to static catalog if DB is cold
    const fixed = FIXED_SERVICES_CATALOG.find(
      (s) => s.slug.toLowerCase() === cleanIdentifier,
    );

    if (!fixed) {
      throw new NotFoundException(`Service offering '${idOrSlug}' not found`);
    }

    const result = {
      success: true,
      data: {
        id: fixed.slug,
        key: fixed.key,
        slug: fixed.slug,
        group: fixed.group,
        title: fixed.title,
        iconKey: fixed.iconKey,
        summary: fixed.summary,
        description: fixed.description,
        sortOrder: fixed.sortOrder,
        recommendedSymptoms: fixed.recommendedSymptoms,
        status: ServiceCatalogStatus.ACTIVE,
        requestCount: 0,
        reviewCount: 0,
        symptoms: SYMPTOM_DEFINITIONS,
      },
    };

    await this.redis.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * Admin Only: Create a new custom service offering.
   * Automatically derives and deduplicates the slug from title if omitted.
   */
  async createService(dto: CreateServiceDto, user: RequestUser) {
    const baseSlug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.title);

    if (!baseSlug) {
      throw new BadRequestException('A valid title is required to create a service');
    }

    // Auto-resolve unique slug (appends -1, -2 if duplicate exists)
    let targetSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.service.findFirst({
        where: {
          OR: [
            { slug: targetSlug },
            { publicOfferings: { some: { slug: targetSlug } } },
          ],
        },
      });

      if (!existing) {
        break;
      }

      targetSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const service = await this.prisma.$transaction(async (tx) => {
      const createdService = await tx.service.create({
        data: {
          slug: targetSlug,
          name: dto.title.trim(),
          category: dto.group,
          description: dto.description.trim(),
          status: dto.status || ServiceCatalogStatus.ACTIVE,
          commonIssues: dto.recommendedSymptoms || [],
        },
      });

      const createdOffering = await tx.publicServiceOffering.create({
        data: {
          serviceId: createdService.id,
          slug: targetSlug,
          group: dto.group,
          title: dto.title.trim(),
          summary: dto.summary.trim(),
          description: dto.description.trim(),
          iconKey: dto.iconKey?.trim() || 'Wrench',
          sortOrder: dto.sortOrder || 0,
          status: dto.status === ServiceCatalogStatus.INACTIVE ? 'INACTIVE' : 'ACTIVE',
        },
      });

      return { ...createdService, publicOfferings: [createdOffering] };
    });

    await this.redis.del('services:catalog:grouped:public');
    await this.redis.del('services:catalog:grouped:admin');
    await this.redis.del(`services:catalog:slug:${targetSlug}`);

    this.logger.log(`Service '${service.name}' (${service.slug}) created by Admin ${user.email}`);

    return {
      success: true,
      message: `Service '${service.name}' created successfully`,
      data: this.formatService(service),
    };
  }

  /**
   * Admin Only: Update an existing service offering.
   */
  async updateService(idOrSlug: string, dto: UpdateServiceDto, user: RequestUser) {
    const existing = await this.findServiceEntity(idOrSlug);
    if (!existing) {
      throw new NotFoundException(`Service '${idOrSlug}' not found`);
    }

    let targetSlug = existing.slug;
    if (dto.slug && dto.slug.trim() !== '') {
      targetSlug = this.slugify(dto.slug);
      if (targetSlug !== existing.slug) {
        const slugExists = await this.prisma.service.findFirst({
          where: { slug: targetSlug, id: { not: existing.id } },
        });
        if (slugExists) {
          throw new ConflictException(`Slug '${targetSlug}' is already taken by another service`);
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.service.update({
        where: { id: existing.id },
        data: {
          ...(targetSlug ? { slug: targetSlug } : {}),
          ...(dto.title ? { name: dto.title.trim() } : {}),
          ...(dto.group ? { category: dto.group } : {}),
          ...(dto.description ? { description: dto.description.trim() } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.recommendedSymptoms ? { commonIssues: dto.recommendedSymptoms } : {}),
        },
      });

      const offering = existing.publicOfferings?.[0];
      let o;
      if (offering) {
        o = await tx.publicServiceOffering.update({
          where: { id: offering.id },
          data: {
            ...(targetSlug ? { slug: targetSlug } : {}),
            ...(dto.group ? { group: dto.group } : {}),
            ...(dto.title ? { title: dto.title.trim() } : {}),
            ...(dto.summary ? { summary: dto.summary.trim() } : {}),
            ...(dto.description ? { description: dto.description.trim() } : {}),
            ...(dto.iconKey ? { iconKey: dto.iconKey.trim() } : {}),
            ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.status
              ? { status: dto.status === ServiceCatalogStatus.INACTIVE ? 'INACTIVE' : 'ACTIVE' }
              : {}),
          },
        });
      }

      return { ...s, publicOfferings: o ? [o] : [] };
    });

    await this.redis.del('services:catalog:grouped:public');
    await this.redis.del('services:catalog:grouped:admin');
    await this.redis.del(`services:catalog:slug:${existing.slug}`);
    if (targetSlug !== existing.slug) {
      await this.redis.del(`services:catalog:slug:${targetSlug}`);
    }

    this.logger.log(`Service '${updated.name}' updated by Admin ${user.email}`);

    return {
      success: true,
      message: `Service '${updated.name}' updated successfully`,
      data: this.formatService(updated),
    };
  }

  /**
   * Admin Only: Delete or soft-deactivate a service.
   * If service requests exist for this service, deactivates to INACTIVE to preserve audit integrity.
   */
  async deleteService(idOrSlug: string, user: RequestUser) {
    const existing = await this.findServiceEntity(idOrSlug);
    if (!existing) {
      throw new NotFoundException(`Service '${idOrSlug}' not found`);
    }

    const requestCount = await this.prisma.serviceRequest.count({
      where: { serviceId: existing.id },
    });

    if (requestCount > 0) {
      await this.prisma.service.update({
        where: { id: existing.id },
        data: { status: ServiceCatalogStatus.INACTIVE },
      });

      await this.prisma.publicServiceOffering.updateMany({
        where: { serviceId: existing.id },
        data: { status: 'INACTIVE' },
      });

      await this.redis.del('services:catalog:grouped:public');
      await this.redis.del('services:catalog:grouped:admin');
      await this.redis.del(`services:catalog:slug:${existing.slug}`);

      this.logger.log(
        `Service '${existing.name}' has ${requestCount} service request(s). Deactivated to INACTIVE by Admin ${user.email}`,
      );

      return {
        success: true,
        message: `Service '${existing.name}' has ${requestCount} active or past request(s). It was deactivated (status: INACTIVE) to preserve request history.`,
      };
    }

    await this.prisma.service.delete({
      where: { id: existing.id },
    });

    await this.redis.del('services:catalog:grouped:public');
    await this.redis.del('services:catalog:grouped:admin');
    await this.redis.del(`services:catalog:slug:${existing.slug}`);

    this.logger.log(`Service '${existing.name}' permanently deleted by Admin ${user.email}`);

    return {
      success: true,
      message: `Service '${existing.name}' deleted successfully.`,
    };
  }

  /**
   * Ensures all 10 fixed services are mirrored into Prisma database tables.
   */
  async ensureCatalogSeeded() {
    for (const offering of FIXED_SERVICES_CATALOG) {
      try {
        const service = await this.prisma.service.upsert({
          where: { slug: offering.slug },
          create: {
            slug: offering.slug,
            name: offering.title,
            category: offering.group,
            description: offering.description,
            status: ServiceCatalogStatus.ACTIVE,
            commonIssues: offering.recommendedSymptoms,
          },
          update: {
            name: offering.title,
            category: offering.group,
            description: offering.description,
            status: ServiceCatalogStatus.ACTIVE,
            commonIssues: offering.recommendedSymptoms,
          },
        });

        await this.prisma.publicServiceOffering.upsert({
          where: { slug: offering.slug },
          create: {
            serviceId: service.id,
            slug: offering.slug,
            group: offering.group,
            title: offering.title,
            summary: offering.summary,
            description: offering.description,
            iconKey: offering.iconKey,
            sortOrder: offering.sortOrder,
            status: 'ACTIVE',
          },
          update: {
            group: offering.group,
            title: offering.title,
            summary: offering.summary,
            description: offering.description,
            iconKey: offering.iconKey,
            sortOrder: offering.sortOrder,
          },
        });
      } catch (err: any) {
        this.logger.debug(`Seeding note for '${offering.slug}': ${err.message}`);
      }
    }
  }
}

