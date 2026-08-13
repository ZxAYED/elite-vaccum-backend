import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditLogService } from 'src/notifications/audit-log.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { StoreInvoicePdfService } from '../store-invoice-pdf.service';

type Actor = { id: string; role: string };

@Injectable()
export class StoreInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
    private readonly storeInvoicePdfService: StoreInvoicePdfService,
  ) {}

  private isAdmin(actor?: Actor) {
    return actor?.role === Role.ADMIN || actor?.role === Role.STAFF;
  }

  private ensureCanAccessOrder(actor: Actor | undefined, customerId: string) {
    if (!actor) throw new ForbiddenException('Unauthorized');
    if (!this.isAdmin(actor) && actor.id !== customerId) {
      throw new ForbiddenException('You can only access your own orders');
    }
  }

  private async generateInvoiceNumber() {
    const prefix = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    for (let i = 0; i < 20; i++) {
      const suffix = Math.floor(100000 + Math.random() * 900000);
      const invoiceNumber = `${prefix}-${suffix}`;
      const found = await this.prisma.storeInvoice.findUnique({
        where: { invoiceNumber },
        select: { id: true },
      });
      if (!found) return invoiceNumber;
    }
    throw new BadRequestException('Unable to generate invoice number');
  }

  generateInvoice(orderId: string, dto: GenerateInvoiceDto, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id: orderId },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          items: true,
          invoice: true,
        },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);

      if (order.invoice && !dto.regenerate) {
        return {
          id: order.invoice.id,
          invoiceNumber: order.invoice.invoiceNumber,
          pdfUrl: order.invoice.pdfUrl,
          issuedAt: order.invoice.issuedAt,
        };
      }

      const invoiceNumber = order.invoice?.invoiceNumber ?? (await this.generateInvoiceNumber());
      const issuedAt = new Date();
      const pdf = await this.storeInvoicePdfService.generateInvoicePdf(order.id, {
        invoiceNumber,
        orderNumber: order.orderNumber,
        customerName: order.customer.fullName,
        customerEmail: order.customer.email,
        issuedAt,
        shippingAddress: (order.shippingAddressSnapshot as Record<string, unknown>) ?? null,
        billingAddress: (order.billingAddressSnapshot as Record<string, unknown>) ?? null,
        items: order.items.map((item) => ({
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
        subtotalAmount: Number(order.subtotalAmount),
        shippingAmount: Number(order.shippingAmount),
        taxAmount: Number(order.taxAmount),
        discountAmount: Number(order.discountAmount),
        totalAmount: Number(order.totalAmount),
      });

      const saved = order.invoice
        ? await this.prisma.storeInvoice.update({
            where: { storeOrderId: order.id },
            data: { pdfUrl: pdf.filePath, issuedAt },
          })
        : await this.prisma.storeInvoice.create({
            data: {
              storeOrderId: order.id,
              invoiceNumber,
              pdfUrl: pdf.filePath,
              issuedAt,
            },
          });

      await this.auditLogService.log({
        actionType: 'STORE_INVOICE_GENERATED',
        entityType: 'STORE_INVOICE',
        entityId: saved.id,
        userId: actor?.id,
        metadata: { orderId: order.id, invoiceNumber: saved.invoiceNumber },
      });
      await this.notificationsService.notify({
        userId: order.customer.id,
        email: order.customer.email,
        title: 'Invoice generated',
        body: `Invoice ${saved.invoiceNumber} is ready for order ${order.orderNumber}.`,
        referenceType: 'STORE_INVOICE',
        referenceId: saved.id,
      });
      return {
        id: saved.id,
        invoiceNumber: saved.invoiceNumber,
        pdfUrl: saved.pdfUrl,
        issuedAt: saved.issuedAt,
      };
    })();
  }

  getInvoice(orderId: string, actor?: Actor) {
    return (async () => {
      const order = await this.prisma.storeOrder.findUnique({
        where: { id: orderId },
        include: { invoice: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      this.ensureCanAccessOrder(actor, order.customerId);
      if (!order.invoice) throw new NotFoundException('Invoice not generated');
      return order.invoice;
    })();
  }
}
