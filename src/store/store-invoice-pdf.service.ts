import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

type InvoiceItem = {
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type InvoicePayload = {
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  issuedAt: Date;
  shippingAddress: Record<string, unknown> | null;
  billingAddress: Record<string, unknown> | null;
  items: InvoiceItem[];
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
};

@Injectable()
export class StoreInvoicePdfService {
  private esc(text: string) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private buildMinimalPdf(lines: string[]) {
    const content = ['BT', '/F1 10 Tf', '50 790 Td'];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) content.push('0 -14 Td');
      content.push(`(${this.esc(lines[i])}) Tj`);
    }
    content.push('ET');
    const stream = content.join('\n');

    const objects: string[] = [];
    objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
    objects.push(
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    );
    objects.push(
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    );
    objects.push(
      `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
    );

    let pdf = '%PDF-1.4\n';
    const xref: number[] = [0];
    for (const obj of objects) {
      xref.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${obj}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < xref.length; i++) {
      pdf += `${xref[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }

  async generateInvoicePdf(orderId: string, payload: InvoicePayload) {
    const lines: string[] = [];
    lines.push('ELITE - Central Vacuum');
    lines.push(`Invoice: ${payload.invoiceNumber}`);
    lines.push(`Order: ${payload.orderNumber}`);
    lines.push(`Issued: ${payload.issuedAt.toISOString()}`);
    lines.push(`Customer: ${payload.customerName} <${payload.customerEmail}>`);
    lines.push('');
    lines.push('Items:');

    payload.items.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. ${item.productName} (${item.sku ?? '-'}) x${item.quantity} @ ${item.unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)}`,
      );
    });

    lines.push('');
    lines.push(`Subtotal: ${payload.subtotalAmount.toFixed(2)}`);
    lines.push(`Shipping: ${payload.shippingAmount.toFixed(2)}`);
    lines.push(`Tax: ${payload.taxAmount.toFixed(2)}`);
    lines.push(`Discount: ${payload.discountAmount.toFixed(2)}`);
    lines.push(`Total: ${payload.totalAmount.toFixed(2)}`);
    lines.push('');
    lines.push(
      `Shipping Address: ${JSON.stringify(payload.shippingAddress ?? {})}`,
    );
    lines.push(
      `Billing Address: ${JSON.stringify(payload.billingAddress ?? {})}`,
    );

    const buffer = this.buildMinimalPdf(lines);
    const dir = path.join(process.cwd(), 'storage', 'invoices');
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${payload.invoiceNumber}-${orderId}.pdf`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);
    return { filePath, fileName };
  }
}
