export type ProviderErrorType =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'PROVIDER_DOWN'
  | 'INVALID_REQUEST'
  | 'UNKNOWN';

export function classifyProviderError(error: Error): ProviderErrorType {
  const msg = error.message.toLowerCase();

  if (msg.includes('api key') || msg.includes('unauthorized')) {
    return 'AUTH';
  }

  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate')) {
    return 'RATE_LIMIT';
  }

  if (
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('unavailable')
  ) {
    return 'PROVIDER_DOWN';
  }

  if (msg.includes('invalid input') || msg.includes('not allowed')) {
    return 'INVALID_REQUEST';
  }

  return 'UNKNOWN';
}
