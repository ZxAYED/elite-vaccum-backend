import {
  Body,
  Controller,
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
import { CurrentUser, RequestUser } from 'src/common/decorator/currentUser.decorator';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { extractMultipartJsonPayload } from 'src/common/utils/parseJsonPayload';
import { ChatService } from './chat.service';
import {
  ChatConversationQueryDto,
  ChatMessageQueryDto,
} from './dto/chat-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendChatMessageDto } from './dto/send-message.dto';

@ApiTags('Support - Live Chat & Messaging')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start or get an existing support conversation (Customer / Admin)',
    description: 'Creates or finds a support chat room. Automatically assigns available admin to customer.',
  })
  @ApiResponse({ status: 201, description: 'Conversation started or retrieved' })
  async getOrCreateConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getOrCreateConversation(dto, user);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List conversations for the logged-in user with unread counts & online status',
    description: 'Returns customer or admin conversations sorted by lastMessageAt with unread badge count.',
  })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getUserConversations(
    @Query() query: ChatConversationQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getUserConversations(user.id, query, user);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get total unread chat message badge count',
    description: 'Fast aggregate unread count across all active conversations for header badge.',
  })
  @ApiResponse({ status: 200, description: 'Total unread messages count' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const unreadCount = await this.chatService.getUnreadCount(user.id);
    return { success: true, unreadCount };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details and participants' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversationDetails(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getConversationDetails(id, user);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Get paginated message history for a conversation',
    description: 'Retrieves chronological messages and automatically marks conversation as read for the user.',
  })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getConversationMessages(
    @Param('id') id: string,
    @Query() query: ChatMessageQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getConversationMessages(id, query, user);
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('attachments', 5))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Send a message (REST fallback with Cloudinary photo/file uploads)',
    description: 'Sends message in conversation, publishes to Redis PubSub for real-time delivery, and enqueues offline email alert if recipient is offline.',
  })
  @ApiBody({
    description: 'Send chat message payload with optional file attachments',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string of SendChatMessageDto',
          example: '{"content": "Can you check my service appointment time?"}',
        },
        attachments: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Optional file or photo attachments uploaded directly to Cloudinary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @Param('id') id: string,
    @Body() rawBody: any,
    @CurrentUser() user: RequestUser,
    @UploadedFiles() files?: Array<Express.Multer.File>,
  ) {
    const payload = extractMultipartJsonPayload<SendChatMessageDto>(rawBody);
    const dto = plainToInstance(SendChatMessageDto, payload);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    return this.chatService.sendMessage(id, user, dto, files);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  async markConversationAsRead(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.markConversationAsRead(id, user.id);
  }
}
