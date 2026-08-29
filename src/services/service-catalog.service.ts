import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, ServiceCatalogStatus, ServiceGroup } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FIXED_SERVICES_CATALOG,
  FixedServiceOffering,
  SYMPTOM_DEFINITIONS,
} from './constants/services-catalog.constant';

@Injectable()
export class ServiceCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ServiceCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Auto-seed or synchronize database catalog on startup
    await this.ensureCatalogSeeded().catch((err) => {
      this.logger.warn(`Failed to auto-seed services catalog: ${err.message}`);
    });
  }

  /**
   * Returns all 10 fixed services grouped by category along with symptom choices.
   */
  async getCatalogGrouped() {
    // Fetch live DB catalog if available, with fallback to constant
    let dbServices: any[] = [];
    try {
      dbServices = await this.prisma.service.findMany({
        where: { status: ServiceCatalogStatus.ACTIVE },
        include: { publicOfferings: true },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      // Fallback
    }

    const serviceAndMaintenance = FIXED_SERVICES_CATALOG.filter(
      (s) => s.group === ServiceGroup.SERVICE_AND_MAINTENANCE,
    ).map((s) => this.enrichOffering(s, dbServices));

    const installation = FIXED_SERVICES_CATALOG.filter(
      (s) => s.group === ServiceGroup.INSTALLATION,
    ).map((s) => this.enrichOffering(s, dbServices));

    return {
      success: true,
      data: {
        serviceAndMaintenance,
        installation,
        symptoms: SYMPTOM_DEFINITIONS,
      },
      meta: {
        totalServices: FIXED_SERVICES_CATALOG.length,
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
  }

  /**
   * Retrieves specific service metadata by slug.
   */
  async getServiceBySlug(slug: string) {
    const fixed = FIXED_SERVICES_CATALOG.find(
      (s) => s.slug.toLowerCase() === slug.toLowerCase().trim(),
    );

    if (!fixed) {
      throw new NotFoundException('Service offering not found');
    }

    const dbRecord = await this.prisma.service
      .findUnique({
        where: { slug: fixed.slug },
        include: { publicOfferings: true },
      })
      .catch(() => null);

    return {
      success: true,
      data: {
        ...this.enrichOffering(fixed, dbRecord ? [dbRecord] : []),
        symptoms: SYMPTOM_DEFINITIONS,
      },
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
            basePriceUsd: offering.basePriceUsd
              ? new Prisma.Decimal(offering.basePriceUsd)
              : null,
            status: ServiceCatalogStatus.ACTIVE,
          },
          update: {
            name: offering.title,
            category: offering.group,
            description: offering.description,
            basePriceUsd: offering.basePriceUsd
              ? new Prisma.Decimal(offering.basePriceUsd)
              : null,
            status: ServiceCatalogStatus.ACTIVE,
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

  private enrichOffering(
    fixed: FixedServiceOffering,
    dbServices: any[],
  ) {
    const matchedDb = dbServices.find(
      (d) => d.slug.toLowerCase() === fixed.slug.toLowerCase(),
    );

    return {
      id: matchedDb?.id || fixed.slug,
      key: fixed.key,
      slug: fixed.slug,
      group: fixed.group,
      title: fixed.title,
      iconKey: fixed.iconKey,
      summary: fixed.summary,
      description: fixed.description,
      sortOrder: fixed.sortOrder,
      basePriceUsd: fixed.basePriceUsd ? fixed.basePriceUsd.toFixed(2) : null,
      recommendedSymptoms: fixed.recommendedSymptoms,
      status: 'ACTIVE',
    };
  }
}
