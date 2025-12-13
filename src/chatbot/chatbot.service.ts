import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { buildChatGraph } from './agent/agent.graph';
import { ChatbotSchema } from './validation/chatbot.schema';
import { z } from 'zod';
import type { IMemoryBackend } from 'src/memory/memory-backend.interface';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private graph: ReturnType<typeof buildChatGraph>;

  constructor(
    @Inject('MEMORY_BACKEND') private readonly memory: IMemoryBackend,
  ) {}

  onModuleInit() {
    this.graph = buildChatGraph(
      this.memory.loadMemory.bind(this.memory),
      this.memory.saveMemory.bind(this.memory),
    );
  }

  async handleMessage(input: z.infer<typeof ChatbotSchema>) {
    const initialState = {
      sessionId: input.sessionId,
      sessionStartedAt: new Date().toISOString(),

      metadataIp: input.metadataIp,
      metadataDevice: input.metadataDevice,

      providerConfig: input.providerConfig,

      messages: [
        {
          role: 'user',
          content: input.message,
          createdAt: new Date().toISOString(),
        },
      ],

      lastResponse: undefined,
    };

    try {
      const finalState = await this.graph.invoke(initialState);
      return {
        sessionId: finalState.sessionId,
        reply: finalState.lastResponse ?? null,
        messages: finalState.messages,
        streamed: false,
      } as const;
    } catch (e) {
      const error = e as Error;
      if (error.message.includes('API key')) {
        throw new UnauthorizedException(error.message);
      } else if (error.message.includes('Invalid input')) {
        throw new BadRequestException(error.message);
      } else if (error.message.includes('[GoogleGenerativeAI Error]')) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(error.message);
    }
  }
}
