export type SupportedProviders = 'openai' | 'google' | 'anthropic';

export interface ProviderConfig {
  provider: SupportedProviders;
  apiKey: string;
  model: string;

  baseURL?: string;
  organization?: string;
}
