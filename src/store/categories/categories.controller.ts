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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequestUser,
} from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { CategoryListQueryDto } from '../dto/category-list-query.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { StoreCategoriesService } from './categories.service';

@ApiTags('Store - Categories')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('categories')
export class StoreCategoriesController {
  constructor(private readonly categoriesService: StoreCategoriesService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product category (Admin only)' })
  @ApiResponse({ status: 201, description: 'Category successfully created' })
  @ApiResponse({ status: 409, description: 'Category slug already exists' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.categoriesService.createCategory(dto, user);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'List categories with active product counts, optional search, and pagination',
  })
  @ApiResponse({ status: 200, description: 'List of categories returned' })
  getCategories(
    @Query() query: CategoryListQueryDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.categoriesService.getCategories(query, user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get category details by UUID or unique slug' })
  @ApiResponse({ status: 200, description: 'Category details returned' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  getCategoryById(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.categoriesService.getCategoryById(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update category details (Admin only)' })
  @ApiResponse({ status: 200, description: 'Category successfully updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Slug collision' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.categoriesService.updateCategory(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete category if no products are associated (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Category successfully deleted' })
  @ApiResponse({
    status: 409,
    description: 'Category contains active products',
  })
  deleteCategory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.categoriesService.deleteCategory(id, user);
  }
}
