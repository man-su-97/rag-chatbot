export type SupportedProviders = 'openai' | 'google' | 'anthropic';

export interface ProviderConfig {
  provider: SupportedProviders;
  apiKey: string;
  model: string;
  apiVersion?: string;

  baseURL?: string;
  organization?: string;
}
