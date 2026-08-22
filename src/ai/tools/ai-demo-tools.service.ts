import { Injectable } from '@nestjs/common';
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
  async listServices(): Promise<DemoService[]> {
    return demoServices.filter((service) => service.active);
  }

  async getServiceDetails(
    serviceIdentifier: string,
  ): Promise<DemoService | null> {
    const normalizedIdentifier = this.normalize(serviceIdentifier);

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

  async searchProducts(query: string): Promise<DemoProduct[]> {
    const searchTokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 1);

    if (searchTokens.length === 0) {
      return [];
    }

    return demoProducts.filter((product) => {
      if (!product.active) {
        return false;
      }

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

  async getCustomerServiceHistory(customerId: string): Promise<{
    customer: DemoCustomer;
    history: DemoServiceHistoryRecord[];
  } | null> {
    const normalizedCustomerId = customerId.trim().toLowerCase();

    const customer = demoCustomers.find(
      (item) => item.id.toLowerCase() === normalizedCustomerId,
    );

    if (!customer) {
      return null;
    }

    const history = demoServiceHistory.filter(
      (record) => record.customerId === customer.id,
    );

    return {
      customer,
      history,
    };
  }

  async getServiceOrderDetails(serviceOrderId: string): Promise<{
    order: DemoServiceOrder;
    customer: DemoCustomer | null;
    service: DemoService | null;
  } | null> {
    const normalizedId = serviceOrderId.trim().toUpperCase();

    const order = demoServiceOrders.find(
      (item) => item.id.toUpperCase() === normalizedId,
    );

    if (!order) {
      return null;
    }

    const customer =
      demoCustomers.find((item) => item.id === order.customerId) ?? null;

    const service =
      demoServices.find((item) => item.id === order.serviceId) ?? null;

    return {
      order,
      customer,
      service,
    };
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
