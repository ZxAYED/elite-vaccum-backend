import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Public, Roles } from 'src/common/decorator/rolesDecorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto, ReviewListQueryDto } from './dto/review-list-query.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Insights - Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public: List published customer reviews with rating distribution' })
  @ApiResponse({ status: 200, description: 'Published reviews' })
  async findAllPublic(@Query() query: ReviewListQueryDto) {
    return this.reviewsService.findAllPublic(query);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: List own submitted reviews' })
  @ApiResponse({ status: 200, description: 'Customer reviews list' })
  async getMyReviews(
    @Query() query: ReviewListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reviewsService.getMyReviews(query, user);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer: Submit a review for a purchased product or completed service' })
  @ApiResponse({ status: 201, description: 'Review submitted' })
  async create(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reviewsService.create(dto, user);
  }

  @Get('admin/all')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: List all reviews with moderation statuses and KPI counts' })
  @ApiResponse({ status: 200, description: 'Admin reviews list' })
  async findAllAdmin(@Query() query: ReviewListQueryDto) {
    return this.reviewsService.findAllAdmin(query);
  }

  @Patch(':id/moderate')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Moderate review (PUBLISH, HIDE, REJECT)' })
  @ApiResponse({ status: 200, description: 'Review moderation updated' })
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reviewsService.moderate(id, dto, user);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: Delete a review' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  async delete(@Param('id') id: string) {
    return this.reviewsService.delete(id);
  }
}
