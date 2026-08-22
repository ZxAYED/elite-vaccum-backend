import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import {
  CurrentUser,
  RequestUser,
} from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { extractMultipartJsonPayload } from 'src/common/utils/parseJsonPayload';
import { CreateProductDto } from '../dto/create-product.dto';
import { DeleteProductImagesDto } from '../dto/delete-product-images.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { UpdateProductStatusDto } from '../dto/update-product-status.dto';
import { UpdateProductStockDto } from '../dto/update-product-stock.dto';
import { StoreProductsService } from './products.service';

@ApiTags('Store - Products')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('products')
export class StoreProductsController {
  constructor(private readonly productsService: StoreProductsService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary:
      'Create product (SKU auto-generated in backend, multipart images supported)',
  })
  @ApiResponse({ status: 201, description: 'Product successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input payload' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async createProduct(
    @Body() rawBody: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
    @CurrentUser() user?: RequestUser,
  ) {
    const payload = extractMultipartJsonPayload<CreateProductDto>(rawBody);
    const dto = plainToInstance(CreateProductDto, payload);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    return this.productsService.createProduct(dto, files, user);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'List published products with search, dynamic category, price ranges, availability, sorting and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of active products returned',
  })
  listProducts(
    @Query() query: ProductListQueryDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.productsService.listProducts(query, user);
  }

  @Get('admin/list')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin list all products (Draft, Active, Archived) with full filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin full visibility product list',
  })
  getAdminProducts(
    @Query() query: ProductListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.getAdminProducts(query, user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product details by UUID or unique SKU' })
  @ApiResponse({ status: 200, description: 'Product details returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getProductById(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.productsService.getProductById(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary:
      'Unified Update Product: edit fields, upload new images to S3, or delete existing images via deleteImageIds (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Product successfully updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateProduct(
    @Param('id') id: string,
    @Body() rawBody: any,
    @UploadedFiles() files?: Array<Express.Multer.File>,
    @CurrentUser() user?: RequestUser,
  ) {
    const payload = extractMultipartJsonPayload<UpdateProductDto>(rawBody);
    const dto = plainToInstance(UpdateProductDto, payload);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    return this.productsService.updateProduct(id, dto, files, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete product (permanently removes S3 images if unpurchased, or safely archives if orders exist)',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted/archived successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  deleteProduct(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.productsService.deleteProduct(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Quick update product status & availability (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Product status updated' })
  updateProductStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.updateProductStatus(id, dto, user);
  }

  @Patch(':id/stock')
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Quick update inventory stock count with automatic availability adjustment (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Product stock updated' })
  updateProductStock(
    @Param('id') id: string,
    @Body() dto: UpdateProductStockDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.updateProductStock(id, dto, user);
  }

  @Delete(':id/images')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete multiple product images by IDs (removes from DB & S3)',
  })
  @ApiResponse({ status: 200, description: 'Images deleted successfully' })
  deleteProductImages(
    @Param('id') id: string,
    @Body() dto: DeleteProductImagesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.deleteProductImages(id, dto.imageIds, user);
  }

  @Delete(':id/images/:imageId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete single product image by ID (removes from DB & S3)',
  })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  deleteSingleProductImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.productsService.deleteProductImages(id, [imageId], user);
  }
}
