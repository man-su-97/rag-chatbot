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

import { buildAgentGraph } from './agent/buildAgentGraph';
import { AIMessage } from '@langchain/core/messages';

const PLATFORM_DEFAULT_PROVIDER = 'google' as const;
const PLATFORM_DEFAULT_MODEL = 'gemini-1.5-pro-latest';

const PLATFORM_FALLBACK_PROVIDER = 'openai' as const;
const PLATFORM_FALLBACK_MODEL = 'gpt-4o-mini';

function normalizeAIContent(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as any).text);
        }
        return '';
      })
      .join('');
  }

  if (content == null) return '';

  return String(content);
}

@Injectable()
export class ChatbotService implements OnModuleInit {
  private agentGraph: any;

  constructor(
    @Inject('MEMORY_BACKEND') private readonly memory: IMemoryBackend,
    private readonly dashboardToolService: DashboardToolService,
    private readonly sessionConfigService: SessionConfigService,
  ) {}

  onModuleInit() {
    this.agentGraph = buildAgentGraph(
      this.memory.loadMemory.bind(this.memory),
      this.memory.saveMemory.bind(this.memory),
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
      const type = classifyProviderError(e as Error);

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

      throw e;
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
        const initialState = {
          sessionId: input.sessionId,
          sessionStartedAt: new Date().toISOString(),
          metadataIp: input.metadataIp,
          metadataDevice: input.metadataDevice,
          providerConfig: this.resolveProviderConfig(
            this.sessionConfigService.getResolvedConfig(input.sessionId),
          ),
          input: input.message,
        };

        let lastSentContent = '';

        try {
          const stream = await this.streamWithFallback(
            this.agentGraph,
            initialState,
          );

          for await (const chunk of stream) {
            const [nodeName] = Object.keys(chunk);
            if (!nodeName) continue;

            const nodeValue = chunk[nodeName];

            if (nodeName === 'llm' && nodeValue) {
              if (
                Array.isArray(nodeValue.streamingChunks) &&
                nodeValue.streamingChunks.length > 0
              ) {
                const cumulative = nodeValue.streamingChunks
                  .map((c: any) => normalizeAIContent(c.content))
                  .join('');

                if (cumulative.length > lastSentContent.length) {
                  const diff = cumulative.slice(lastSentContent.length);
                  if (diff) {
                    subscriber.next({ type: 'token', content: diff });
                    lastSentContent = cumulative;
                  }
                }
              } else if (Array.isArray(nodeValue.messages)) {
                const lastMessage =
                  nodeValue.messages[nodeValue.messages.length - 1];

                if (lastMessage instanceof AIMessage) {
                  const normalized = normalizeAIContent(lastMessage.content);

                  if (normalized && normalized !== lastSentContent) {
                    subscriber.next({
                      type: 'token',
                      content: normalized,
                    });
                    lastSentContent = normalized;
                  }

                  for (const call of lastMessage.tool_calls ?? []) {
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
                }
              }
            }

            if (nodeName === 'saveMemory') {
              subscriber.next({ type: 'done' });
              subscriber.complete();
              return;
            }
          }
        } catch (e) {
          subscriber.next({
            type: 'error',
            message: (e as Error).message,
          });
          subscriber.error(
            new InternalServerErrorException((e as Error).message),
          );
        }
      };

      void run();
    });
  }

  async handleMessage(input: z.infer<typeof ChatbotSchema>) {
    const finalState = await this.agentGraph.invoke({
      sessionId: input.sessionId,
      sessionStartedAt: new Date().toISOString(),
      metadataIp: input.metadataIp,
      metadataDevice: input.metadataDevice,
      providerConfig: this.resolveProviderConfig(
        this.sessionConfigService.getResolvedConfig(input.sessionId),
      ),
      input: input.message,
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
