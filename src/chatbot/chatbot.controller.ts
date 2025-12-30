import {
  Body,
  Controller,
  Post,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Param,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiTags } from '@nestjs/swagger';

import { ChatbotService } from './chatbot.service';
import { ChatbotSchema } from './validation/chatbot.schema';
import { SessionConfigSchema } from './validation/session-config.schema';
import {
  ChatHistoryResponseDto,
  NewSessionResponseDto,
  StreamMessageDto,
} from './dto/chatbot.dto';
import { StreamEvent } from './types'; // Corrected import

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('session/new')
  @HttpCode(HttpStatus.CREATED)
  createNewSession(): NewSessionResponseDto {
    return { sessionId: this.chatbotService.createNewSessionId() };
  }

  @Get('history/:sessionId')
  async getHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<ChatHistoryResponseDto> {
    const history = await this.chatbotService.getHistory(sessionId);
    return { history };
  }

  @Post('session/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  async configureSession(@Body() body: unknown) {
    const parsed = SessionConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    await this.chatbotService.configureSession(parsed.data);
  }

  @Post('message')
  async sendMessage(@Body() body: unknown) {
    const parsed = ChatbotSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    return this.chatbotService.handleMessage(parsed.data);
  }

  @Get('chat-stream')
  async stream(
    @Query() query: StreamMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ChatbotSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    res.flushHeaders();

    const stream$ = this.chatbotService.handleMessageStream(parsed.data);

    const subscription = stream$.subscribe({
      next: (data: StreamEvent) => {
        // Corrected type
        try {
          res.write(JSON.stringify(data) + '\n');
        } catch (err) {
          console.error('Write failed:', err);
        }
      },

      error: (err) => {
        console.error('Stream error:', err);
        res.write(
          JSON.stringify({
            type: 'error',
            message: err?.message ?? 'Stream error',
          }) + '\n',
        );
        res.end();
      },

      complete: () => {
        res.end();
      },
    });

    req.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
