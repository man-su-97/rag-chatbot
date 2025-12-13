export type SupportedProviders = 'openai' | 'google' | 'anthropic';

export interface ProviderConfig {
  provider: SupportedProviders;
  apiKey: string;
  model: string;
  baseURL?: string;
  organization?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  createdAt: string;
}

export interface ChatResponseDto {
  sessionId: string;
  reply?: string | null;
  messages: ChatMessage[];
  streamed?: boolean;
}
