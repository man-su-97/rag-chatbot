import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ProviderConfig } from './config';

export function createModel(config: ProviderConfig) {
  switch (config.provider) {
    case 'openai':
      return new ChatOpenAI({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'google':
      return new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'anthropic':
      return new ChatAnthropic({
        apiKey: config.apiKey,
        model: config.model,
      });

    default:
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
  }
}
