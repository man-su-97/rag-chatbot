export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

class InMemoryChatStore {
  private store = new Map<string, ChatMessage[]>();

  getMessages(sessionId: string): ChatMessage[] {
    return this.store.get(sessionId) ?? [];
  }

  addMessage(sessionId: string, msg: ChatMessage): void {
    const existing = this.store.get(sessionId) ?? [];
    this.store.set(sessionId, [...existing, msg]);
  }

  clear(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

export const MemoryStore = new InMemoryChatStore();
