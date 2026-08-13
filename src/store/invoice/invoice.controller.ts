import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { StoreInvoiceService } from './invoice.service';

@ApiTags('Store - Invoice')
@ApiBearerAuth('bearer')
@Controller()
export class StoreInvoiceController {
  constructor(private readonly invoiceService: StoreInvoiceService) {}

  @Post('orders/:id/invoice/generate')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Generate invoice on-demand' })
  generateInvoice(
    @Param('id') id: string,
    @Body() dto: GenerateInvoiceDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.invoiceService.generateInvoice(id, dto, req?.user);
  }

  @Get('orders/:id/invoice')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Get invoice metadata only' })
  getInvoice(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.invoiceService.getInvoice(id, req?.user);
  }

  @Get('orders/:id/invoice/download')
  @Roles('ADMIN', 'STAFF', 'CUSTOMER')
  @ApiOperation({ summary: 'Download invoice PDF (explicit call only)' })
  async downloadInvoice(
    @Param('id') id: string,
    @Req() req: { user?: { id: string; role: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoiceService.getInvoice(id, req?.user);
    const filePath = invoice.pdfUrl;
    if (!filePath) {
      throw new NotFoundException('Invoice file is missing');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    return new StreamableFile(createReadStream(filePath));
  }
}

