import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  demoCustomers,
  demoProducts,
  demoServiceHistory,
  demoServiceOrders,
  demoServices,
  type DemoCustomer,
  type DemoProduct,
  type DemoService,
  type DemoServiceHistoryRecord,
  type DemoServiceOrder,
} from './ai-demo-tools.data';

@Injectable()
export class AiDemoToolsService {
  private readonly logger = new Logger(AiDemoToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists available central vacuum services from live database (with demo fallback).
   */
  async listServices(): Promise<any[]> {
    try {
      const liveServices = await this.prisma.service.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      });

      if (liveServices && liveServices.length > 0) {
        return liveServices.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          category: s.category,
          description: s.description,
          basePriceUsd: s.basePriceUsd ? Number(s.basePriceUsd) : 100,
          active: true,
        }));
      }
    } catch (err: any) {
      this.logger.warn(`Failed to query live services for AI: ${err.message}. Falling back to demo data.`);
    }

    return demoServices.filter((service) => service.active);
  }

  /**
   * Fetches service details by ID, slug, or name from live DB.
   */
  async getServiceDetails(serviceIdentifier: string): Promise<any | null> {
    const normalizedIdentifier = this.normalize(serviceIdentifier);

    try {
      const liveService = await this.prisma.service.findFirst({
        where: {
          OR: [
            { id: { equals: serviceIdentifier, mode: 'insensitive' } },
            { slug: { equals: normalizedIdentifier, mode: 'insensitive' } },
            { name: { contains: serviceIdentifier, mode: 'insensitive' } },
          ],
        },
      });

      if (liveService) {
        return {
          id: liveService.id,
          slug: liveService.slug,
          name: liveService.name,
          category: liveService.category,
          description: liveService.description,
          basePriceUsd: liveService.basePriceUsd ? Number(liveService.basePriceUsd) : 100,
          active: liveService.status === 'ACTIVE',
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to get live service for AI: ${err.message}`);
    }

    return (
      demoServices.find((service) => {
        return (
          this.normalize(service.id) === normalizedIdentifier ||
          this.normalize(service.slug) === normalizedIdentifier ||
          this.normalize(service.name) === normalizedIdentifier
        );
      }) ?? null
    );
  }

  /**
   * Searches products in live e-commerce inventory with keyword search and fallback.
   */
  async searchProducts(query: string): Promise<any[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const liveProducts = await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { sku: { contains: trimmed, mode: 'insensitive' } },
            { model: { contains: trimmed, mode: 'insensitive' } },
            { description: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        include: { category: true },
        take: 10,
      });

      if (liveProducts && liveProducts.length > 0) {
        return liveProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || 'N/A',
          model: p.model || 'N/A',
          category: p.category?.slug || 'parts',
          description: p.description,
          priceUsd: Number(p.priceUsd),
          active: true,
        }));
      }
    } catch (err: any) {
      this.logger.warn(`Failed to search live products for AI: ${err.message}`);
    }

    const searchTokens = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);

    return demoProducts.filter((product) => {
      if (!product.active) return false;
      const searchableText = [
        product.name,
        product.sku,
        product.model,
        product.category,
        product.description,
      ]
        .join(' ')
        .toLowerCase();
      return searchTokens.some((token) => searchableText.includes(token));
    });
  }

  /**
   * Retrieves customer service history from live database (or demo dataset).
   */
  async getCustomerServiceHistory(customerId: string): Promise<any | null> {
    const normalized = customerId.trim();

    try {
      const customer = await this.prisma.customer.findFirst({
        where: {
          OR: [
            { id: { equals: normalized, mode: 'insensitive' } },
            { email: { equals: normalized, mode: 'insensitive' } },
            { phone: { equals: normalized, mode: 'insensitive' } },
          ],
        },
        include: {
          serviceRequests: {
            take: 5,
            orderBy: { submittedAt: 'desc' },
          },
          serviceOrders: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (customer) {
        return {
          customer: {
            id: customer.id,
            displayName: customer.displayName,
            email: customer.email,
            phone: customer.phone,
          },
          history: customer.serviceOrders.map((so) => ({
            id: so.id,
            businessId: so.businessId,
            status: so.status,
            summary: so.summary,
            scheduledAt: so.scheduledAt,
          })),
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to query live customer for AI: ${err.message}`);
    }

    const demoCustomer = demoCustomers.find(
      (item) => item.id.toLowerCase() === normalized.toLowerCase(),
    );

    if (!demoCustomer) return null;

    const history = demoServiceHistory.filter(
      (record) => record.customerId === demoCustomer.id,
    );

    return {
      customer: demoCustomer,
      history,
    };
  }

  /**
   * Retrieves live service order details.
   */
  async getServiceOrderDetails(serviceOrderId: string): Promise<any | null> {
    const normalized = serviceOrderId.trim();

    try {
      const liveOrder = await this.prisma.serviceOrder.findFirst({
        where: {
          OR: [
            { id: { equals: normalized, mode: 'insensitive' } },
            { businessId: { equals: normalized, mode: 'insensitive' } },
          ],
        },
        include: {
          customer: true,
          serviceRequest: true,
        },
      });

      if (liveOrder) {
        return {
          order: {
            id: liveOrder.id,
            businessId: liveOrder.businessId,
            status: liveOrder.status,
            summary: liveOrder.summary,
            scheduledAt: liveOrder.scheduledAt,
            totalUsd: Number(liveOrder.totalUsd),
          },
          customer: liveOrder.customer,
          service: liveOrder.serviceRequest,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to query live service order for AI: ${err.message}`);
    }

    const demoOrder = demoServiceOrders.find(
      (item) => item.id.toUpperCase() === normalized.toUpperCase(),
    );

    if (!demoOrder) return null;

    const customer =
      demoCustomers.find((item) => item.id === demoOrder.customerId) ?? null;
    const service =
      demoServices.find((item) => item.id === demoOrder.serviceId) ?? null;

    return {
      order: demoOrder,
      customer,
      service,
    };
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
