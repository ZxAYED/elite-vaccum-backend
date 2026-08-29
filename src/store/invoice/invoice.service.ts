import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { generateBusinessId } from 'src/common/utils/business-id.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { StoreInvoicePdfService } from '../store-invoice-pdf.service';

@Injectable()
export class StoreInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeInvoicePdfService: StoreInvoicePdfService,
  ) {}

  private isAdmin(user?: RequestUser | null) {
    return user?.role === UserRole.ADMIN;
  }

  private isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  async getInvoiceByOrderId(orderId: string, user?: RequestUser | null) {
    const isUuid = this.isUuid(orderId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: orderId } : { businessId: orderId },
      include: {
        customer: true,
        invoices: {
          include: {
            lineItems: { orderBy: { sortOrder: 'asc' } },
            payments: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isAdmin(user) && (!user || user.id !== order.customer.userId)) {
      throw new ForbiddenException('You do not have permission to access this invoice');
    }

    const invoice = order.invoices[0];
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this order');
    }

    return {
      orderId: order.id,
      orderBusinessId: order.businessId,
      invoice,
    };
  }

  async generateInvoicePdf(
    orderId: string,
    dto: GenerateInvoiceDto,
    user?: RequestUser | null,
  ) {
    const isUuid = this.isUuid(orderId);

    const order = await this.prisma.productOrder.findFirst({
      where: isUuid ? { id: orderId } : { businessId: orderId },
      include: {
        customer: true,
        items: true,
        invoices: {
          include: {
            lineItems: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isAdmin(user) && (!user || user.id !== order.customer.userId)) {
      throw new ForbiddenException('You do not have permission to generate this invoice');
    }

    let invoice = order.invoices[0];

    if (!invoice) {
      const businessId = await generateBusinessId('INV', async (id) => {
        const exists = await this.prisma.invoice.findUnique({
          where: { businessId: id },
          select: { id: true },
        });
        return !!exists;
      });
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      invoice = await this.prisma.invoice.create({
        data: {
          businessId,
          customerId: order.customerId,
          productOrderId: order.id,
          status: InvoiceStatus.ISSUED,
          dueDate,
          subtotalUsd: order.subtotalUsd,
          taxUsd: order.taxUsd,
          discountUsd: order.discountUsd,
          totalUsd: order.totalUsd,
          notes: 'Order Invoice',
          lineItems: {
            create: order.items.map((item, idx) => ({
              description: `${item.productName} (SKU: ${item.productSku || 'N/A'})`,
              quantity: item.quantity,
              unitPriceUsd: item.unitPriceUsd,
              totalUsd: item.totalUsd,
              sortOrder: idx,
            })),
          },
        },
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
      });
    }

    const pdf = await this.storeInvoicePdfService.generateInvoicePdf(order.id, {
      invoiceNumber: invoice.businessId,
      orderNumber: order.businessId,
      customerName: order.customer.displayName,
      customerEmail: order.customer.email,
      issuedAt: invoice.issueDate,
      shippingAddress: (order.shippingAddress as Record<string, unknown>) ?? null,
      billingAddress: (order.shippingAddress as Record<string, unknown>) ?? null,
      items: order.items.map((item) => ({
        productName: item.productName,
        sku: item.productSku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPriceUsd),
        lineTotal: Number(item.totalUsd),
      })),
      subtotalAmount: Number(order.subtotalUsd),
      shippingAmount: Number(order.shippingFeeUsd),
      taxAmount: Number(order.taxUsd),
      discountAmount: Number(order.discountUsd),
      totalAmount: Number(order.totalUsd),
    });

    return {
      success: true,
      invoiceId: invoice.id,
      businessId: invoice.businessId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalUsd: Number(invoice.totalUsd),
      pdfPath: pdf.filePath,
      fileName: pdf.fileName,
    };
  }
}
