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

export type StreamEvent =
  | { type: 'token'; content: string }
  | {
      type: 'command';
      target: 'dashboard';
      action: 'add_widget' | 'update_widget' | 'delete_widget' | 'list_widgets';
      params: Record<string, any>;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface LangChainMessage {
  type: string;
  kwargs: any;
}

export type SerializedMessage =
  | {
      type: 'human' | 'ai' | 'system' | 'tool';
      kwargs: any;
    }
  | {
      role: 'user' | 'assistant' | 'system';
      content: string;
    };
