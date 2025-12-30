import { BaseMessage } from '@langchain/core/messages';

export interface IMemoryBackend {
  loadMemory(sessionId: string): Promise<BaseMessage[]>;
  saveMemory(sessionId: string, messages: BaseMessage[]): Promise<void>;
}
