import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Sse,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatbotSchema } from './validation/chatbot.schema';
import { SessionConfigSchema } from './validation/session-config.schema';
import { ConfigureSessionDto, SendMessageDto } from './dto/chatbot.dto';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('session/configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Configure a chat session',
    description:
      'Sets the provider, model, and optional API key for a specific session ID. This configuration is stored on the server.',
  })
  @ApiBody({ type: ConfigureSessionDto })
  @ApiResponse({ status: 204, description: 'Configuration successful.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
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
  @ApiOperation({
    summary: 'Send a message to the chatbot',
    description:
      'Sends a user message to the specified session and receives a response. The backend will use the pre-configured provider for the session or fall back to system defaults.',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 200,
    description: 'The chatbot response.',
  })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
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

  @ApiExcludeEndpoint()
  @Sse('stream')
  stream() {
    throw new BadRequestException(
      'Use /chatbot/stream/send to POST and /chatbot/stream?sessionId=... to subscribe (see README).',
    );
  }

  @ApiExcludeEndpoint()
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
