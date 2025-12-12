export type SupportedProviders = 'openai' | 'google' | 'anthropic';

export interface ProviderConfig {
  provider: SupportedProviders;
  apiKey: string;
  model: string;
  baseURL?: string;
  organization?: string;
}

// Chat message used inside state & persistence
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  // optional metadata like timestamp, messageId could be added
  createdAt?: string;
}

// Final response DTO returned by controller
export interface ChatResponseDto {
  sessionId: string;
  reply?: string | null;
  messages: ChatMessage[];
  streamed?: boolean;
}
