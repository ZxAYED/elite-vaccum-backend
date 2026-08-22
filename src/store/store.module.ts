import { Module } from '@nestjs/common';
import { StoreAddressesController } from './addresses/addresses.controller';
import { StoreAddressesService } from './addresses/addresses.service';
import { StoreCartController } from './cart/cart.controller';
import { StoreCartService } from './cart/cart.service';
import { StoreCategoriesController } from './categories/categories.controller';
import { StoreCategoriesService } from './categories/categories.service';
import { StoreInvoiceController } from './invoice/invoice.controller';
import { StoreInvoiceService } from './invoice/invoice.service';
import { StoreOrdersController } from './orders/orders.controller';
import { StoreOrdersService } from './orders/orders.service';
import { StoreProductsController } from './products/products.controller';
import { StoreProductsService } from './products/products.service';
import { StoreReturnsController } from './returns/returns.controller';
import { StoreReturnsService } from './returns/returns.service';
import { StoreInvoicePdfService } from './store-invoice-pdf.service';

@Module({
  controllers: [
    StoreCategoriesController,
    StoreProductsController,
    StoreCartController,
    StoreOrdersController,
    StoreAddressesController,
    StoreInvoiceController,
    StoreReturnsController,
  ],
  providers: [
    StoreInvoicePdfService,
    StoreCategoriesService,
    StoreProductsService,
    StoreCartService,
    StoreOrdersService,
    StoreAddressesService,
    StoreInvoiceService,
    StoreReturnsService,
  ],
})
export class StoreModule {}
