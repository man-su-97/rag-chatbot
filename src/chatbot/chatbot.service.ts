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
        const graph = this.agentGraph;

        const providerConfig = this.resolveProviderConfig(
          this.sessionConfigService.getResolvedConfig(input.sessionId),
        );

        const initialState = {
          sessionId: input.sessionId,
          sessionStartedAt: new Date().toISOString(),
          metadataIp: input.metadataIp,
          metadataDevice: input.metadataDevice,
          providerConfig,
          input: input.message,
        };

        try {
          const stream = await this.streamWithFallback(graph, initialState);
          let lastSentContent = '';

          for await (const chunk of stream) {
            const keys = Object.keys(chunk);
            if (keys.length === 0) continue;

            const nodeName = keys[0];
            const nodeValue = chunk[nodeName];

            console.log(`Processing node: ${nodeName}`);

            if (nodeName === 'llm' && nodeValue) {
              console.log('LLM node detected');
              console.log(
                '  streamingChunks:',
                nodeValue.streamingChunks?.length || 0,
              );
              console.log('  messages:', nodeValue.messages?.length || 0);

              // ✅ Case 1: Streaming with chunks
              if (
                nodeValue.streamingChunks &&
                Array.isArray(nodeValue.streamingChunks) &&
                nodeValue.streamingChunks.length > 0
              ) {
                console.log('Using streaming path');
                const cumulativeContent = nodeValue.streamingChunks
                  .map((chunk: any) => chunk.content || '')
                  .join('');

                console.log(
                  '  Cumulative content length:',
                  cumulativeContent.length,
                );
                console.log('  Last sent length:', lastSentContent.length);

                if (cumulativeContent.length > lastSentContent.length) {
                  const diff = cumulativeContent.slice(lastSentContent.length);
                  if (diff) {
                    console.log('Emitting diff:', diff.substring(0, 50));
                    subscriber.next({ type: 'token', content: diff });
                  }
                  lastSentContent = cumulativeContent;
                }
              }
              // ✅ Case 2: Invoke fallback
              else if (nodeValue.messages && nodeValue.messages.length > 0) {
                console.log('✅ Using invoke fallback path');
                const lastMessage =
                  nodeValue.messages[nodeValue.messages.length - 1];

                console.log(
                  '  Last message type:',
                  lastMessage?.constructor?.name,
                );
                console.log(
                  '  Is AIMessage?',
                  lastMessage instanceof AIMessage,
                );
                console.log('  Content type:', typeof lastMessage?.content);
                console.log(
                  '  Content:',
                  lastMessage?.content?.substring(0, 100),
                );

                const isAIMessage =
                  lastMessage instanceof AIMessage ||
                  (lastMessage as any)?._getType?.() === 'ai';

                if (isAIMessage && typeof lastMessage.content === 'string') {
                  if (
                    lastMessage.content &&
                    lastMessage.content !== lastSentContent
                  ) {
                    console.log('📤 Emitting invoke content');
                    subscriber.next({
                      type: 'token',
                      content: lastMessage.content,
                    });
                    lastSentContent = lastMessage.content;
                  } else {
                    console.warn('Content is empty or already sent');
                  }
                } else {
                  console.warn(
                    'Last message is not AIMessage or content is not string',
                  );
                }
              } else {
                console.warn(
                  '⚠️ Neither streaming chunks nor messages available!',
                );
                console.warn('   nodeValue keys:', Object.keys(nodeValue));
              }

              if (nodeValue.messages && nodeValue.messages.length > 0) {
                for (const msg of nodeValue.messages) {
                  if (msg instanceof AIMessage) {
                    const toolCalls = msg.tool_calls || [];
                    for (const call of toolCalls) {
                      if (call?.name === 'dashboard') {
                        const { action, ...params } = call.args ?? {};
                        console.log('🔧 Emitting command:', action);
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
            }

            if (nodeName === 'tools') {
              console.log('🔧 Tools node executed');
              continue;
            }

            if (nodeName === 'saveMemory') {
              console.log('💾 Memory saved, completing stream');
              subscriber.next({ type: 'done' });
              subscriber.complete();
              return;
            }
          }

          console.log('⚠️ Stream ended without saveMemory node');
          subscriber.next({ type: 'done' });
          subscriber.complete();
        } catch (e) {
          const error = e as Error;
          console.error('❌ Stream error:', error);
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
    const graph = this.agentGraph;

    const providerConfig = this.resolveProviderConfig(
      this.sessionConfigService.getResolvedConfig(input.sessionId),
    );

    const finalState = await graph.invoke({
      sessionId: input.sessionId,
      sessionStartedAt: new Date().toISOString(),
      metadataIp: input.metadataIp,
      metadataDevice: input.metadataDevice,
      providerConfig,
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
