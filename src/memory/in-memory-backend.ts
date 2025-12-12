import { Injectable } from '@nestjs/common';
import type { IMemoryBackend } from './memory-backend.interface';

@Injectable()
export class InMemoryBackend implements IMemoryBackend {
  private store = new Map<string, any>();

  async loadMemory(sessionId: string) {
    return this.store.get(sessionId) ?? null;
  }

  async saveMemory(sessionId: string, state: any) {
    this.store.set(sessionId, state);
  }
}
