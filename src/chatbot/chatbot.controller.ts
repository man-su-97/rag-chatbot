import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Sse,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotSchema } from './validation/chatbot.schema';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

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

  @Sse('stream')
  stream() {
    throw new BadRequestException(
      'Use /chatbot/stream/send to POST and /chatbot/stream?sessionId=... to subscribe (see README).',
    );
  }

  @Post('stream/send')
  async streamSend(@Body() body: unknown) {
    const parsed = ChatbotSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    return this.chatbotService.handleMessage(parsed.data);
  }
}
