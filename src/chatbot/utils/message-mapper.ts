import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ChatMessage, SerializedMessage } from '../types';

export function mapBaseMessageToChatMessage(msg: unknown): ChatMessage | null {
  if (msg instanceof BaseMessage) {
    let role: ChatMessage['role'];

    if (msg instanceof HumanMessage) role = 'user';
    else if (msg instanceof AIMessage) role = 'assistant';
    else if (msg instanceof SystemMessage) role = 'system';
    else return null;

    const content =
      typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: any) => ('text' in c ? c.text : '')).join('')
          : '';

    return {
      role,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  if (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    'content' in msg
  ) {
    const persisted = msg as Partial<ChatMessage>;

    return {
      role: persisted.role ?? 'assistant',
      content: persisted.content ?? '',
      createdAt: persisted.createdAt ?? new Date().toISOString(),
    };
  }

  return null;
}

export function hydrateMessages(messages: SerializedMessage[]): BaseMessage[] {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }

  const hydrated: BaseMessage[] = [];

  for (const msg of messages) {
    try {
      if (!msg || typeof msg !== 'object') {
        console.warn('Invalid message format:', msg);
        continue;
      }

      let baseMessage: BaseMessage | null = null;

      if ('type' in msg) {
        // Handle LangChain .toJSON() format
        const type = msg.type;
        if (typeof type !== 'string') {
          console.warn('Invalid LangChain message type:', type);
          continue;
        }
        const kwargs = msg.kwargs || {};
        const content = kwargs.content || '';

        switch (type) {
          case 'human':
            baseMessage = new HumanMessage({
              content,
            });
            break;

          case 'ai':
            baseMessage = new AIMessage({
              content,
              additional_kwargs: kwargs.additional_kwargs || {},
              tool_calls: kwargs.tool_calls || [],
              response_metadata: kwargs.response_metadata || {},
            });
            break;

          case 'system':
            baseMessage = new SystemMessage({
              content,
            });
            break;

          case 'tool':
            baseMessage = new ToolMessage({
              content,
              tool_call_id: kwargs.tool_call_id || '',
            });
            break;

          default:
            console.warn('Unknown LangChain message type:', type);
            baseMessage = new HumanMessage(content);
        }
      } else if ('role' in msg) {
        // Handle simple { role, content } format
        const role = msg.role;
        const content = msg.content || '';

        switch (role) {
          case 'user':
            baseMessage = new HumanMessage(content);
            break;
          case 'assistant':
            baseMessage = new AIMessage(content);
            break;
          case 'system':
            baseMessage = new SystemMessage(content);
            break;
          default:
            console.warn('Unknown simple message role:', role);
            baseMessage = new HumanMessage(content);
        }
      } else {
        console.warn('Unrecognized message format:', msg);
      }

      if (baseMessage) {
        hydrated.push(baseMessage);
      }
    } catch (error) {
      console.error('Error hydrating message:', error, msg);
    }
  }

  return hydrated;
}
