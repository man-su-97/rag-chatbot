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
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatbotSchema } from './validation/chatbot.schema';
import { SessionConfigSchema } from './validation/session-config.schema';
import {
  ChatHistoryResponseDto,
  ConfigureSessionDto,
  NewSessionResponseDto,
  SendMessageDto,
  StreamMessageDto,
} from './dto/chatbot.dto';

import { StreamData } from './types';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('session/new')
  @ApiOperation({
    summary: 'Create a new chat session',
    description:
      'Generates and returns a new unique session ID for starting a fresh chat conversation.',
  })
  @ApiResponse({
    status: 201,
    description: 'A new session has been created successfully.',
    type: NewSessionResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  createNewSession(): NewSessionResponseDto {
    const sessionId = this.chatbotService.createNewSessionId();
    return { sessionId };
  }

  @Get('history/:sessionId')
  @ApiOperation({
    summary: 'Get chat history for a session',
    description:
      'Retrieves the full conversation history for a given session ID.',
  })
  @ApiParam({
    name: 'sessionId',
    type: String,
    description: 'The unique identifier for the chat session.',
    example: 'session-12345',
  })
  @ApiResponse({
    status: 200,
    description: 'The conversation history.',
    type: ChatHistoryResponseDto,
  })
  async getHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<ChatHistoryResponseDto> {
    const history = await this.chatbotService.getHistory(sessionId);
    return { history };
  }

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
    summary: 'Send a message to the chatbot (non-streaming)',
    description:
      'Sends a user message and waits for the full response. For a streaming response, use the GET /chat-stream endpoint.',
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

  @Get('chat-stream')
  @ApiOperation({
    summary: 'Send a message to the chatbot (streaming)',
    description:
      'Sends a user message and receives a stream of events as the response is generated. Uses Newline-Delimited JSON (NDJSON).',
  })
  @ApiQuery({ type: StreamMessageDto })
  @ApiResponse({
    status: 200,
    description: 'A stream of message events in NDJSON format.',
    content: {
      'application/x-ndjson': {
        schema: {
          type: 'string',
          example:
            '{"sessionId":"session-123","token":"Hello","done":false}\n' +
            '{"sessionId":"session-123","token":" there","done":false}\n' +
            '{"done":true}\n',
        },
      },
    },
  })
  async stream(
    @Query() query: StreamMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ChatbotSchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const streamObservable = this.chatbotService.handleMessageStream(
        parsed.data,
      );

      await new Promise<void>((resolve, reject) => {
        streamObservable.subscribe({
          next: (streamData: StreamData) => {
            res.write(JSON.stringify(streamData) + '\n');
          },
          error: (error) => {
            console.error('Error in chat stream:', error);
            res.write(
              JSON.stringify({ type: 'error', message: error.message }) + '\n',
            );
            reject(error);
          },
          complete: () => {
            resolve();
          },
        });
      });
    } catch (error) {
      console.error('Unhandled error in chat stream:', error);
      res.write(
        JSON.stringify({ type: 'error', message: (error as Error).message }) +
          '\n',
      );
    } finally {
      res.end();
    }
  }
}
