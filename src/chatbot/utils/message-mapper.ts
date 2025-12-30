import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatMessage } from '../types';

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

/**
 * Hydrates plain message objects from the database into LangChain BaseMessage instances.
 * This is crucial for preventing errors when passing persisted messages back into the graph.
 * @param messages An array of plain objects, typically from a database query.
 * @returns An array of `BaseMessage` instances.
 */
export function hydrateMessages(
  messages: { role: string; content: string }[],
): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage(msg.content);
      case 'assistant':
        return new AIMessage(msg.content);
      case 'system':
        return new SystemMessage(msg.content);
      default:
        // Fallback for unknown roles, though this should ideally not happen.
        return new HumanMessage(msg.content);
    }
  });
}
