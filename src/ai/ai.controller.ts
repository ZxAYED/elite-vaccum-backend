import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiBody,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Roles } from '../common/decorator/rolesDecorator';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { AiChatResponseDto } from './dto/ai.swagger';
import { ServiceIntakeDto } from './dto/service-intake.dto';

@ApiTags('AI')
@ApiBearerAuth('bearer')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) { }


  @Post('chat/stream')
  @Roles(UserRole.ADMIN,
    UserRole.STAFF,
    UserRole.CUSTOMER,
    UserRole.TECHNICIAN,)
  @ApiOperation({ summary: 'Stream a Gemini response' })
  @ApiBody({ type: ChatDto })
  async streamChat(
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.streamChat(dto.message)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write(`event: done\ndata: [DONE]\n\n`);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Streaming failed';

      res.write(
        `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
      );
    } finally {
      res.end();
    }

    req.on('close', () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
  }




  @Post('chat')
  @Roles(
    UserRole.ADMIN,
    UserRole.STAFF,
    UserRole.CUSTOMER,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Send a chat prompt to the configured AI provider' })
  @ApiBody({ type: ChatDto })
  @ApiOkResponse({
    description: 'AI provider generated a response.',
    type: AiChatResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid AI chat payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiServiceUnavailableResponse({ description: 'AI provider is unavailable or not configured.' })
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto.message);
  }


  @Post('service-intake')
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ADMIN,
    UserRole.STAFF,
  )
  @ApiOperation({
    summary: 'Analyze a customer service problem',
  })
  @ApiBody({ type: ServiceIntakeDto })
  analyzeServiceIntake(@Body() dto: ServiceIntakeDto) {
    return this.aiService.analyzeServiceIntake(dto.message);
  }

}
