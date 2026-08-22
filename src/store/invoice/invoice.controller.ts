import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream, existsSync } from 'fs';
import type { Response } from 'express';
import {
  CurrentUser,
  RequestUser,
} from 'src/common/decorator/currentUser.decorator';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { StoreInvoiceService } from './invoice.service';

@ApiTags('Store - Invoices')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('store/invoices')
export class StoreInvoiceController {
  constructor(private readonly invoiceService: StoreInvoiceService) {}

  @Get('orders/:orderId')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Get invoice details for an order' })
  @ApiResponse({ status: 200, description: 'Invoice details returned' })
  getInvoice(
    @Param('orderId') orderId: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.invoiceService.getInvoiceByOrderId(orderId, user);
  }

  @Post('orders/:orderId/generate')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Generate and download invoice PDF for an order' })
  @ApiResponse({ status: 200, description: 'Invoice PDF generated' })
  generateInvoice(
    @Param('orderId') orderId: string,
    @Body() dto: GenerateInvoiceDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.invoiceService.generateInvoicePdf(orderId, dto, user);
  }

  @Get('orders/:orderId/download')
  @Roles('CUSTOMER', 'ADMIN')
  @ApiOperation({ summary: 'Download invoice PDF file' })
  async downloadInvoice(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.invoiceService.generateInvoicePdf(
      orderId,
      { regenerate: false },
      user,
    );

    if (!existsSync(result.pdfPath)) {
      throw new NotFoundException('Invoice PDF file not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    return new StreamableFile(createReadStream(result.pdfPath));
  }
}
