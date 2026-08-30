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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { Roles } from 'src/common/decorator/rolesDecorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated notifications for current user',
    description: 'Retrieves inbox notifications with isRead filter, type filter, pagination, and real-time unreadCount.',
  })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getMyNotifications(
    @Query() query: NotificationQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get fast unread notification count',
    description: 'Ultra-fast cached unread count for badge headers in web and mobile applications.',
  })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { success: true, unreadCount: count };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification delivery preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  async getPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification delivery preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  async updatePreferences(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      emailNotifications?: boolean;
      smsNotifications?: boolean;
      pushNotifications?: boolean;
      preferences?: Record<string, any>;
    },
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Admin: Send/Enqueue a notification to a user',
    description: 'Dispatches notification via BullMQ background queue with instant WSS push and optional email.',
  })
  @ApiResponse({ status: 202, description: 'Notification enqueued for processing' })
  async createNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.create(dto, user);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all unread notifications as read',
    description: 'Sets all unread notifications to read: true and broadcasts count: 0 over WebSocket.',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark single notification as read',
    description: 'Marks specified notification as read and emits live count update via WSS.',
  })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.deleteNotification(id, user.id);
  }
}
