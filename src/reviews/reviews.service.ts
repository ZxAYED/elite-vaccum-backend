import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  ReviewModerationAction,
  ReviewStatus,
  ReviewType,
} from '@prisma/client';
import { RequestUser } from 'src/common/decorator/currentUser.decorator';
import { getPagination } from 'src/common/utils/pagination';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto, ReviewListQueryDto } from './dto/review-list-query.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private reviewInclude() {
    return {
      customer: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          model: true,
          summary: true,
          priceUsd: true,
          status: true,
          availability: true,
          isFeatured: true,
          images: {
            select: {
              id: true,
              key: true,
              url: true,
              alt: true,
              isPrimary: true,
              sortOrder: true,
            },
            orderBy: { isPrimary: 'desc' },
          },
        },
      },
      productOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
          totalUsd: true,
          placedAt: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
        },
      },
      serviceOrder: {
        select: {
          id: true,
          businessId: true,
          status: true,
        },
      },
      moderationHistory: {
        orderBy: { createdAt: 'desc' },
      },
    } satisfies Prisma.CustomerReviewInclude;
  }


  // CUSTOMER: SUBMIT REVIEW


  async create(dto: CreateReviewDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile required to submit a review');
    }

    if (dto.type === ReviewType.PRODUCT && !dto.productId) {
      throw new BadRequestException('productId is required for product reviews');
    }

    if (dto.type === ReviewType.SERVICE && !dto.serviceId && !dto.serviceOrderId) {
      throw new BadRequestException('serviceId or serviceOrderId is required for service reviews');
    }

    let serviceId = dto.serviceId;
    if (!serviceId && dto.serviceOrderId) {
      const order = await this.prisma.serviceOrder.findUnique({
        where: { id: dto.serviceOrderId },
        include: { serviceRequest: true },
      });
      if (order?.serviceRequest?.serviceId) {
        serviceId = order.serviceRequest.serviceId;
      }
    }

    const preview =
      dto.body.length > 150 ? `${dto.body.substring(0, 147)}...` : dto.body;

    const review = await this.prisma.customerReview.create({
      data: {
        type: dto.type,
        status: ReviewStatus.PUBLISHED, // Auto-publish genuine verified customer reviews
        customerId: customer.id,
        customerName: customer.displayName,
        productId: dto.productId || null,
        productOrderId: dto.productOrderId || null,
        serviceId: serviceId || null,
        serviceOrderId: dto.serviceOrderId || null,
        rating: dto.rating,
        title: dto.title.trim(),
        body: dto.body.trim(),
        preview,
        publishedAt: new Date(),
      },
      include: this.reviewInclude(),
    });

    this.logger.log(`Customer '${customer.displayName}' submitted ${dto.type} review (${dto.rating} stars)`);

    // Notify Admins
    this.notificationsService
      .notifyAdmins({
        type: NotificationType.REVIEW_MODERATION,
        title: `New ${dto.type} Review (${dto.rating} Stars)`,
        message: `Customer ${customer.displayName} submitted a ${dto.rating}-star review: "${dto.title}".`,
        ctaLabel: 'Moderate Review',
        ctaUrl: `/admin/reviews/${review.id}`,
        metadata: {
          reviewId: review.id,
          rating: dto.rating,
          type: dto.type,
        },
        priority: 2,
      })
      .catch((err) => {
        this.logger.warn(`Failed to notify admins of new review: ${err.message}`);
      });

    return {
      success: true,
      message: 'Review submitted successfully',
      review,
    };
  }


  // PUBLIC: LIST PUBLISHED REVIEWS


  async findAllPublic(query: ReviewListQueryDto) {
    const where: Prisma.CustomerReviewWhereInput = {
      status: ReviewStatus.PUBLISHED,
      ...(query.type ? { type: query.type } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const totalItems = await this.prisma.customerReview.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const items = await this.prisma.customerReview.findMany({
      where,
      skip,
      take,
      orderBy: { submittedAt: 'desc' },
      include: this.reviewInclude(),
    });

    // Rating distribution analytics
    const aggregate = await this.prisma.customerReview.aggregate({
      where,
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      items,
      meta: {
        ...meta,
        analytics: {
          averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 5.0,
          totalReviews: aggregate._count.id,
        },
      },
    };
  }


  // CUSTOMER: LIST OWN REVIEWS


  async getMyReviews(query: ReviewListQueryDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!customer) {
      return { items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    }

    const where: Prisma.CustomerReviewWhereInput = {
      customerId: customer.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const totalItems = await this.prisma.customerReview.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const items = await this.prisma.customerReview.findMany({
      where,
      skip,
      take,
      orderBy: { submittedAt: 'desc' },
      include: this.reviewInclude(),
    });

    return { items, meta };
  }

  /**
   * Customer: Get all products reviewed by the authenticated customer with review and product details.
   */
  async getMyReviewedProducts(query: ReviewListQueryDto, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true, displayName: true },
    });

    if (!customer) {
      return {
        items: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          analytics: {
            averageRatingGiven: 0,
            totalReviewedProducts: 0,
          },
        },
      };
    }

    const where: Prisma.CustomerReviewWhereInput = {
      customerId: customer.id,
      type: ReviewType.PRODUCT,
      productId: { not: null },
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const totalItems = await this.prisma.customerReview.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const [reviews, aggregate] = await Promise.all([
      this.prisma.customerReview.findMany({
        where,
        skip,
        take,
        orderBy: { submittedAt: 'desc' },
        include: this.reviewInclude(),
      }),
      this.prisma.customerReview.aggregate({
        where,
        _avg: { rating: true },
        _count: { id: true },
      }),
    ]);

    const items = reviews.map((r) => ({
      review: {
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        preview: r.preview,
        status: r.status,
        submittedAt: r.submittedAt,
        publishedAt: r.publishedAt,
      },
      product: r.product
        ? {
            id: r.product.id,
            name: r.product.name,
            sku: r.product.sku,
            model: r.product.model,
            summary: r.product.summary,
            priceUsd: r.product.priceUsd ? Number(r.product.priceUsd) : 0,
            status: r.product.status,
            availability: r.product.availability,
            isFeatured: r.product.isFeatured,
            images: r.product.images || [],
          }
        : null,
      order: r.productOrder
        ? {
            id: r.productOrder.id,
            businessId: r.productOrder.businessId,
            status: r.productOrder.status,
            totalUsd: r.productOrder.totalUsd ? Number(r.productOrder.totalUsd) : 0,
            placedAt: r.productOrder.placedAt,
          }
        : null,
    }));

    return {
      items,
      meta: {
        ...meta,
        analytics: {
          averageRatingGiven: aggregate._avg.rating
            ? Number(aggregate._avg.rating.toFixed(1))
            : 0,
          totalReviewedProducts: aggregate._count.id,
        },
      },
    };
  }

  /**
   * Customer: Get own review for a specific product by product ID, SKU, or model.
   */
  async getMyProductReview(productIdOrIdentifier: string, user: RequestUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true, displayName: true },
    });

    if (!customer) {
      return {
        hasReviewed: false,
        product: null,
        review: null,
      };
    }

    const trimmed = productIdOrIdentifier.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        trimmed,
      );

    const product = await this.prisma.product.findFirst({
      where: isUuid
        ? { id: trimmed }
        : {
            OR: [
              { sku: { equals: trimmed, mode: 'insensitive' } },
              { model: { equals: trimmed, mode: 'insensitive' } },
              { name: { contains: trimmed, mode: 'insensitive' } },
            ],
          },
      select: {
        id: true,
        name: true,
        sku: true,
        model: true,
        priceUsd: true,
        images: {
          select: {
            id: true,
            key: true,
            url: true,
            alt: true,
            isPrimary: true,
          },
          orderBy: { isPrimary: 'desc' },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product '${productIdOrIdentifier}' not found`);
    }

    const review = await this.prisma.customerReview.findFirst({
      where: {
        customerId: customer.id,
        productId: product.id,
      },
      include: this.reviewInclude(),
      orderBy: { submittedAt: 'desc' },
    });

    return {
      hasReviewed: !!review,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        model: product.model,
        priceUsd: product.priceUsd ? Number(product.priceUsd) : 0,
        primaryImage: product.images?.[0] || null,
      },
      review: review
        ? {
            id: review.id,
            rating: review.rating,
            title: review.title,
            body: review.body,
            preview: review.preview,
            status: review.status,
            submittedAt: review.submittedAt,
            publishedAt: review.publishedAt,
          }
        : null,
    };
  }


  // ADMIN: MODERATION


  async findAllAdmin(query: ReviewListQueryDto) {
    const where: Prisma.CustomerReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const totalItems = await this.prisma.customerReview.count({ where });
    const { skip, take, meta } = getPagination(query.page, query.limit, totalItems);

    const [items, pendingCount, publishedCount, hiddenCount] = await Promise.all([
      this.prisma.customerReview.findMany({
        where,
        skip,
        take,
        orderBy: { submittedAt: 'desc' },
        include: this.reviewInclude(),
      }),
      this.prisma.customerReview.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.customerReview.count({ where: { status: ReviewStatus.PUBLISHED } }),
      this.prisma.customerReview.count({ where: { status: ReviewStatus.HIDDEN } }),
    ]);

    return {
      items,
      meta: {
        ...meta,
        kpi: {
          pending: pendingCount,
          published: publishedCount,
          hidden: hiddenCount,
          total: totalItems,
        },
      },
    };
  }

  async moderate(id: string, dto: ModerateReviewDto, user: RequestUser) {
    const review = await this.prisma.customerReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    let newStatus = review.status;
    let publishedAt = review.publishedAt;
    let hiddenAt = review.hiddenAt;

    if (dto.action === ReviewModerationAction.PUBLISHED) {
      newStatus = ReviewStatus.PUBLISHED;
      publishedAt = new Date();
      hiddenAt = null;
    } else if (
      dto.action === ReviewModerationAction.HIDDEN ||
      dto.action === ReviewModerationAction.DELETED
    ) {
      newStatus = ReviewStatus.HIDDEN;
      hiddenAt = new Date();
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerReview.update({
        where: { id },
        data: {
          status: newStatus,
          publishedAt,
          hiddenAt,
        },
        include: this.reviewInclude(),
      });

      await tx.reviewModerationHistory.create({
        data: {
          reviewId: id,
          action: dto.action,
          reason: dto.reason?.trim() || null,
          note: dto.note?.trim() || null,
          actorLabel: `Admin (${user.email})`,
          actorId: user.id,
        },
      });

      // If published, notify customer
      if (dto.action === ReviewModerationAction.PUBLISHED) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: review.customerId },
          select: { userId: true },
        });

        if (customer?.userId) {
          this.notificationsService
            .create({
              userId: customer.userId,
              type: NotificationType.REVIEW_MODERATION,
              title: 'Your Review Has Been Published!',
              message: `Your review "${review.title}" is now live on Elite Central Vacuum. Thank you for your feedback!`,
              ctaLabel: 'View Review',
              ctaUrl: `/reviews`,
              metadata: { reviewId: review.id },
              sendEmail: false,
              priority: 2,
            })
            .catch((err) => {
              this.logger.warn(`Failed to notify customer of review publication: ${err.message}`);
            });
        }
      }

      return {
        success: true,
        message: `Review moderation status updated to ${newStatus}`,
        review: updated,
      };
    });
  }

  async delete(id: string) {
    const review = await this.prisma.customerReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.customerReview.delete({ where: { id } });

    return {
      success: true,
      message: 'Review deleted successfully',
    };
  }
}
