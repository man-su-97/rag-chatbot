import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderConfig, SupportedProviders } from './types';
import {
  SessionConfigPayload,
  ALLOWED_MODELS,
} from './validation/session-config.schema';

@Injectable()
export class SessionConfigService {
  private sessionConfigs = new Map<string, ProviderConfig>();
  private readonly defaultProvider: SupportedProviders;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultProvider =
      this.configService.get<SupportedProviders>('DEFAULT_PROVIDER') ??
      'google';
    this.defaultModel =
      this.configService.get<string>('DEFAULT_MODEL') ?? 'gemini-1.5-flash';
  }

  /**
   * Creates and stores a configuration for a given session.
   * It resolves the API key, using a fallback if not provided.
   */
  public createSessionConfig(payload: SessionConfigPayload): void {
    const apiKey = payload.apiKey ?? this.getFallbackApiKey(payload.provider);

    if (!apiKey) {
      throw new UnauthorizedException(
        `No API key provided and no fallback key configured for provider: ${payload.provider}.`,
      );
    }

    const config: ProviderConfig = {
      provider: payload.provider,
      model: payload.model,
      apiKey,
    };

    this.sessionConfigs.set(payload.sessionId, config);
  }

  /**
   * Retrieves the configuration for a session, falling back to system
   * defaults if no session-specific configuration exists.
   */
  public getResolvedConfig(sessionId: string): ProviderConfig {
    // 1. Check for session-specific configuration
    const sessionConfig = this.sessionConfigs.get(sessionId);
    if (sessionConfig) {
      return sessionConfig;
    }

    // 2. Fallback to system defaults
    const apiKey = this.getFallbackApiKey(this.defaultProvider);
    if (!apiKey) {
      throw new UnauthorizedException(
        `No session config found and no fallback API key configured for default provider: ${this.defaultProvider}.`,
      );
    }

    if (!ALLOWED_MODELS[this.defaultProvider].includes(this.defaultModel)) {
      throw new Error(
        `Default model ${this.defaultModel} is not allowed for default provider ${this.defaultProvider}`,
      );
    }

    return {
      provider: this.defaultProvider,
      model: this.defaultModel,
      apiKey,
    };
  }

  private getFallbackApiKey(provider: SupportedProviders): string | undefined {
    const keyMap: Record<SupportedProviders, string> = {
      google: 'GOOGLE_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
    };
    const envVar = keyMap[provider];
    return this.configService.get<string>(envVar);
  }
}
