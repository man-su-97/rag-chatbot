import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'google', 'anthropic']),
  apiKey: z.string().min(1, 'API key required'),
  model: z.string().min(1, 'Model name required'),
  baseURL: z.string().url().optional(),
  organization: z.string().optional(),
});

export const ChatbotSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),

  metadataIp: z.string().optional(),
  metadataDevice: z.string().optional(),
  providerConfig: ProviderConfigSchema,
});
