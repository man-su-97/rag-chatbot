export interface IMemoryBackend {
  loadMemory(sessionId: string): Promise<any>;
  saveMemory(sessionId: string, state: any): Promise<void>;
}
