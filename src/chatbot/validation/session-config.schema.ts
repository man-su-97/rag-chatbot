import { z } from 'zod';
import { SupportedProviders } from '../types';

export const ALLOWED_PROVIDERS: SupportedProviders[] = [
  'google',
  'openai',
  'anthropic',
];

export const ALLOWED_MODELS: Record<SupportedProviders, string[]> = {
  google: ['gemini-pro', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ],
};

export const SessionConfigSchema = z
  .object({
    sessionId: z.string().min(1),
    provider: z.enum(ALLOWED_PROVIDERS),
    model: z.string(),
    apiKey: z.string().optional(),
  })
  .refine((data) => ALLOWED_MODELS[data.provider].includes(data.model), {
    message: 'The provided model is not allowed for the selected provider.',
    path: ['model'],
  });

export type SessionConfigPayload = z.infer<typeof SessionConfigSchema>;
