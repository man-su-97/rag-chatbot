import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { ChatbotSchema } from './validation/chatbot.schema';
import type { IMemoryBackend } from '../memory/memory-backend.interface';
import { DashboardToolService } from './tools/DashboardToolService';
import { SessionConfigService } from './session-config.service';
import { SessionConfigPayload } from './validation/session-config.schema';
import { ChatMessage, StreamEvent } from './types';
import { classifyProviderError } from './errors/provider-error.util';
import { mapBaseMessageToChatMessage } from './utils/message-mapper';

import { AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import { buildAgentGraph } from './agent/buildAgentGraph';

const PLATFORM_DEFAULT_PROVIDER = 'google' as const;
const PLATFORM_DEFAULT_MODEL = 'gemini-1.5-pro-latest';

const PLATFORM_FALLBACK_PROVIDER = 'openai' as const;
const PLATFORM_FALLBACK_MODEL = 'gpt-4o-mini';

@Injectable()
export class ChatbotService implements OnModuleInit {
  private agentGraph: any;

  constructor(
    @Inject('MEMORY_BACKEND') private readonly memory: IMemoryBackend,
    private readonly dashboardToolService: DashboardToolService,
    private readonly sessionConfigService: SessionConfigService,
  ) {}

  onModuleInit() {
    const memoryLoader = this.memory.loadMemory.bind(this.memory);
    const memorySaver = this.memory.saveMemory.bind(this.memory);

    // Initialize the single agent graph with tools for all interactions
    this.agentGraph = buildAgentGraph(
      memoryLoader,
      memorySaver,
      this.dashboardToolService.getTools(),
    );
  }

  private resolveProviderConfig(rawConfig: any) {
    return {
      provider: rawConfig?.provider ?? PLATFORM_DEFAULT_PROVIDER,
      model: rawConfig?.model ?? PLATFORM_DEFAULT_MODEL,
      apiKey: rawConfig?.apiKey ?? process.env.DEFAULT_LLM_API_KEY ?? '',
    };
  }

  private async streamWithFallback(graph: any, initialState: any) {
    try {
      return await graph.stream(initialState, { streamMode: 'updates' });
    } catch (e) {
      const error = e as Error;
      const type = classifyProviderError(error);

      if (type === 'RATE_LIMIT' || type === 'PROVIDER_DOWN') {
        return graph.stream(
          {
            ...initialState,
            providerConfig: {
              provider: PLATFORM_FALLBACK_PROVIDER,
              model: PLATFORM_FALLBACK_MODEL,
              apiKey: process.env.DEFAULT_OPENAI_API_KEY ?? '',
            },
          },
          { streamMode: 'updates' },
        );
      }

      throw error;
    }
  }

  createNewSessionId(): string {
    return uuidv4();
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const memory = await this.memory.loadMemory(sessionId);
    return (memory || [])
      .map(mapBaseMessageToChatMessage)
      .filter(isChatMessage);
  }

  async configureSession(payload: SessionConfigPayload) {
    this.sessionConfigService.createSessionConfig(payload);
  }

  handleMessageStream(
    input: z.infer<typeof ChatbotSchema>,
  ): Observable<StreamEvent> {
    return new Observable((subscriber) => {
      const run = async () => {
        const graph = this.agentGraph; // Always use the single agentGraph

        const providerConfig = this.resolveProviderConfig(
          this.sessionConfigService.getResolvedConfig(input.sessionId),
        );

        const initialState = {
          sessionId: input.sessionId,
          sessionStartedAt: new Date().toISOString(),
          metadataIp: input.metadataIp,
          metadataDevice: input.metadataDevice,
          providerConfig,
          messages: [new HumanMessage(input.message)],
        };

        try {
          const stream = await this.streamWithFallback(graph, initialState);

          for await (const chunk of stream) {
            const keys = Object.keys(chunk);
            if (keys.length === 0) continue;

            const nodeName = keys[0];
            const nodeValue = chunk[nodeName];

            if (nodeName === 'llm') {
              if (!nodeValue) continue;

              if (nodeValue instanceof AIMessageChunk) {
                if (
                  typeof nodeValue.content === 'string' &&
                  nodeValue.content.length > 0
                ) {
                  subscriber.next({
                    type: 'token',
                    content: nodeValue.content,
                  });
                }
                continue;
              }

              if (typeof nodeValue === 'object' && 'tool_calls' in nodeValue) {
                const toolCalls = (nodeValue as any).tool_calls;

                if (Array.isArray(toolCalls)) {
                  for (const call of toolCalls) {
                    if (call?.name === 'dashboard') {
                      const { action, ...params } = call.args ?? {};
                      subscriber.next({
                        type: 'command',
                        target: 'dashboard',
                        action,
                        params,
                      });
                    }
                  }

                  subscriber.complete();
                  return;
                }
              }
            }
          }

          subscriber.next({ type: 'done' });
          subscriber.complete();
        } catch (e) {
          const error = e as Error;
          subscriber.next({
            type: 'error',
            message: error.message,
          });
          subscriber.error(new InternalServerErrorException(error.message));
        }
      };

      void run();
    });
  }

  async handleMessage(input: z.infer<typeof ChatbotSchema>) {
    const graph = this.agentGraph; // Always use the single agentGraph

    const providerConfig = this.resolveProviderConfig(
      this.sessionConfigService.getResolvedConfig(input.sessionId),
    );

    const finalState = await graph.invoke({
      sessionId: input.sessionId,
      sessionStartedAt: new Date().toISOString(),
      metadataIp: input.metadataIp,
      metadataDevice: input.metadataDevice,
      providerConfig,
      messages: [new HumanMessage(input.message)],
    });

    const mappedMessages = (finalState.messages || [])
      .map(mapBaseMessageToChatMessage)
      .filter(isChatMessage);

    const last = mappedMessages[mappedMessages.length - 1];

    return {
      sessionId: finalState.sessionId,
      reply: last?.role === 'assistant' ? last.content : null,
      messages: mappedMessages,
      streamed: false,
    } as const;
  }
}

function isChatMessage(msg: ChatMessage | null): msg is ChatMessage {
  return msg !== null;
}
