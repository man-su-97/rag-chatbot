import { Injectable } from '@nestjs/common';
import { ChatMessage } from 'src/chatbot/types';

const store: Record<string, ChatMessage[]> = {};

@Injectable()
export class InMemoryService {
  async load(sessionId: string) {
    return store[sessionId] ?? [];
  }

  async save(sessionId: string, messages: ChatMessage[]) {
    store[sessionId] = messages;
  }
}
