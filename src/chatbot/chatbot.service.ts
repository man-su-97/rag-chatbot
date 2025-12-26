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
import { DashboardToolService } from './tools/DashboardToolService';
import { SessionConfigService } from './session-config.service';
import { SessionConfigPayload } from './validation/session-config.schema';
import { Observable } from 'rxjs';
import { ChatMessage, StreamData } from './types';
import { v4 as uuidv4 } from 'uuid';
import { classifyProviderError } from './errors/provider-error.util';

const PLATFORM_DEFAULT_PROVIDER = 'google' as const;
const PLATFORM_DEFAULT_MODEL = 'gemini-2.5-flash';

const PLATFORM_FALLBACK_PROVIDER = 'openai' as const;
const PLATFORM_FALLBACK_MODEL = 'gpt-4o-mini';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private graph: ReturnType<typeof buildChatGraph>;

  constructor(
    @Inject('MEMORY_BACKEND') private readonly memory: IMemoryBackend,
    private readonly dashboardToolService: DashboardToolService,
    private readonly sessionConfigService: SessionConfigService,
  ) {}

  onModuleInit() {
    const tools = this.dashboardToolService.getTools();

    this.graph = buildChatGraph(
      this.memory.loadMemory.bind(this.memory),
      this.memory.saveMemory.bind(this.memory),
      tools,
    );
  }

  private resolveProviderConfig(rawConfig: any) {
    return {
      provider: rawConfig?.provider ?? PLATFORM_DEFAULT_PROVIDER,
      model: rawConfig?.model ?? PLATFORM_DEFAULT_MODEL,
      apiKey: rawConfig?.apiKey ?? process.env.DEFAULT_LLM_API_KEY ?? '',
      baseURL: rawConfig?.baseURL,
      organization: rawConfig?.organization,
    };
  }

  private async invokeWithFallback(initialState: any) {
    try {
      return await this.graph.invoke(initialState);
    } catch (e) {
      const error = e as Error;
      const type = classifyProviderError(error);

      if (type === 'AUTH' || type === 'INVALID_REQUEST') {
        throw error;
      }

      if (type === 'RATE_LIMIT' || type === 'PROVIDER_DOWN') {
        const fallbackState = {
          ...initialState,
          providerConfig: {
            provider: PLATFORM_FALLBACK_PROVIDER,
            model: PLATFORM_FALLBACK_MODEL,
            apiKey: process.env.DEFAULT_OPENAI_API_KEY ?? '',
          },
        };

        return this.graph.invoke(fallbackState);
      }

      throw error;
    }
  }
  private async streamWithFallback(initialState: any) {
    try {
      return await this.graph.stream(initialState, {
        streamMode: 'values',
      });
    } catch (e) {
      const error = e as Error;
      const type = classifyProviderError(error);

      if (type === 'AUTH' || type === 'INVALID_REQUEST') {
        throw error;
      }

      if (type === 'RATE_LIMIT' || type === 'PROVIDER_DOWN') {
        const fallbackState = {
          ...initialState,
          providerConfig: {
            provider: PLATFORM_FALLBACK_PROVIDER,
            model: PLATFORM_FALLBACK_MODEL,
            apiKey: process.env.DEFAULT_OPENAI_API_KEY ?? '',
          },
        };

        return this.graph.stream(fallbackState, {
          streamMode: 'values',
        });
      }

      throw error;
    }
  }

  createNewSessionId(): string {
    return uuidv4();
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const memory = await this.memory.loadMemory(sessionId);
    return memory?.messages ?? [];
  }

  async configureSession(payload: SessionConfigPayload) {
    this.sessionConfigService.createSessionConfig(payload);
  }

  handleMessageStream(
    input: z.infer<typeof ChatbotSchema>,
  ): Observable<StreamData> {
    return new Observable((subscriber) => {
      const run = async () => {
        const rawConfig = this.sessionConfigService.getResolvedConfig(
          input.sessionId,
        );

        const providerConfig = this.resolveProviderConfig(rawConfig);

        const initialState = {
          sessionId: input.sessionId,
          sessionStartedAt: new Date().toISOString(),
          metadataIp: input.metadataIp,
          metadataDevice: input.metadataDevice,
          providerConfig,
          messages: [
            {
              role: 'user',
              content: input.message,
              createdAt: new Date().toISOString(),
            },
          ],
        };

        let lastMessages: ChatMessage[] = [];
        let lastReply: string | null = null;

        try {
          const stream = await this.streamWithFallback(initialState);

          for await (const chunk of stream) {
            if (!chunk.messages) continue;

            lastMessages = chunk.messages;
            const lastMessage = lastMessages[lastMessages.length - 1];

            if (lastMessage?.role === 'assistant') {
              lastReply = lastMessage.content;

              subscriber.next({
                type: 'response.token',
                sessionId: input.sessionId,
                token: lastMessage.content,
              });
            }
          }

          subscriber.next({
            type: 'response.completed',
            sessionId: input.sessionId,
            reply: lastReply,
            messages: lastMessages,
          });

          subscriber.complete();
        } catch (e) {
          const error = e as Error;
          const type = classifyProviderError(error);

          if (type === 'AUTH') {
            subscriber.error(new UnauthorizedException(error.message));
          } else if (type === 'INVALID_REQUEST') {
            subscriber.error(new BadRequestException(error.message));
          } else {
            subscriber.error(new InternalServerErrorException(error.message));
          }
        }
      };

      void run();
    });
  }

  async handleMessage(input: z.infer<typeof ChatbotSchema>) {
    const rawConfig = this.sessionConfigService.getResolvedConfig(
      input.sessionId,
    );

    const providerConfig = this.resolveProviderConfig(rawConfig);

    const initialState = {
      sessionId: input.sessionId,
      sessionStartedAt: new Date().toISOString(),
      metadataIp: input.metadataIp,
      metadataDevice: input.metadataDevice,
      providerConfig,
      messages: [
        {
          role: 'user',
          content: input.message,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    try {
      const finalState = await this.invokeWithFallback(initialState);

      const messages = finalState.messages;
      const lastMessage = messages[messages.length - 1];

      return {
        sessionId: finalState.sessionId,
        reply: lastMessage?.role === 'assistant' ? lastMessage.content : null,
        messages,
        streamed: false,
      } as const;
    } catch (e) {
      const error = e as Error;
      const type = classifyProviderError(error);

      if (type === 'AUTH') {
        throw new UnauthorizedException(error.message);
      }

      if (type === 'INVALID_REQUEST') {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(error.message);
    }
  }
}
