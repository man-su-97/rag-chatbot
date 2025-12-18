import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ProviderConfig } from './config';

export function createModel(
  config: ProviderConfig,
  tools?: DynamicStructuredTool[],
) {
  let model;

  switch (config.provider) {
    case 'openai': {
      model = new ChatOpenAI({
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0,
        streaming: false,
      });
      break;
    }

    case 'google': {
      model = new ChatGoogleGenerativeAI({
        apiKey: config.apiKey,
        model: config.model,
        apiVersion: config.apiVersion ?? 'v1beta',
        temperature: 0,
        streaming: false,
      });
      break;
    }

    case 'anthropic': {
      model = new ChatAnthropic({
        apiKey: config.apiKey,
        model: config.model,
        temperature: 0,
        streaming: false,
      });
      break;
    }

    default:
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
  }

  // Bind tools ONLY if present
  if (tools && tools.length > 0) {
    return model.bindTools(tools);
  }

  return model;
}
