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

export type StreamTokenData = {
  type: 'response.token';
  sessionId: string;
  token: string;
};

export type StreamCompletionData = {
  type: 'response.completed';
  sessionId: string;
  reply: string | null;
  messages: ChatMessage[];
};

export type StreamData = StreamTokenData | StreamCompletionData;
