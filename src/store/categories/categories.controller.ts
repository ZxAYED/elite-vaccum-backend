import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { CreateSubCategoryDto } from '../dto/create-subcategory.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { UpdateSubCategoryDto } from '../dto/update-subcategory.dto';
import { StoreCategoriesService } from './categories.service';

@ApiTags('Store - Categories')
@ApiBearerAuth('bearer')
@Controller()
export class StoreCategoriesController {
  constructor(private readonly categoriesService: StoreCategoriesService) {}

  @Post('categories')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create parent/child category (admin/staff)' })
  createCategory(@Body() dto: CreateCategoryDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.createCategory(dto, req?.user);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List categories (public active, admin all)' })
  getCategories(@Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.getCategories(req?.user);
  }

  @Get('categories/admin/tree')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Admin category tree' })
  getAdminTree(@Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.getAdminCategoryTree(req?.user);
  }

  @Get('categories/:id')
  @Public()
  @ApiOperation({ summary: 'Get category by id' })
  getCategoryById(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.getCategoryById(id, req?.user);
  }

  @Patch('categories/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update category' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.categoriesService.updateCategory(id, dto, req?.user);
  }

  @Delete('categories/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Delete/deactivate category safely' })
  deleteCategory(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.deleteCategory(id, req?.user);
  }

  @Post('subcategories')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create subcategory (admin/staff)' })
  createSubCategory(@Body() dto: CreateSubCategoryDto, @Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.createSubCategory(dto, req?.user);
  }

  @Patch('subcategories/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Update subcategory' })
  updateSubCategory(
    @Param('id') id: string,
    @Body() dto: UpdateSubCategoryDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.categoriesService.updateSubCategory(id, dto, req?.user);
  }

  @Delete('subcategories/:id')
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Delete/deactivate subcategory safely' })
  deleteSubCategory(@Param('id') id: string, @Req() req?: { user?: { id: string; role: string } }) {
    return this.categoriesService.deleteSubCategory(id, req?.user);
  }

  @Get('categories/:id/products')
  @Public()
  @ApiOperation({ summary: 'List products under category' })
  getCategoryProducts(
    @Param('id') id: string,
    @Query() query: ProductListQueryDto,
    @Req() req?: { user?: { id: string; role: string } },
  ) {
    return this.categoriesService.getCategoryProducts(id, query, req?.user);
  }
}

