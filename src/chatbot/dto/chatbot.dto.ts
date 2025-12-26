import { ApiProperty } from '@nestjs/swagger';
import { ALLOWED_PROVIDERS } from '../validation/session-config.schema';

export class ConfigureSessionDto {
  @ApiProperty({
    description: 'The unique identifier for the chat session.',
    example: 'session-12345',
  })
  sessionId: string;

  @ApiProperty({
    description: 'The AI provider to use for the session.',
    enum: ALLOWED_PROVIDERS,
    example: 'google',
  })
  provider: (typeof ALLOWED_PROVIDERS)[number];

  @ApiProperty({
    description:
      'The specific model to use for the session. Must be compatible with the selected provider.',
    example: 'gemini-1.5-flash',
  })
  model: string;

  @ApiProperty({
    description: '(Optional) A user-provided API key for the provider.',
    required: false,
    example: 'gsk_...',
  })
  apiKey?: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'The unique identifier for the chat session.',
    example: 'session-12345',
  })
  sessionId: string;

  @ApiProperty({
    description: 'The user message to send to the chatbot.',
    example: 'Hello, who are you?',
  })
  message: string;

  @ApiProperty({
    description: '(Optional) The IP address of the user for metadata purposes.',
    required: false,
    example: '192.168.1.1',
  })
  metadataIp?: string;

  @ApiProperty({
    description:
      '(Optional) The device information of the user for metadata purposes.',
    required: false,
    example: 'Chrome on macOS',
  })
  metadataDevice?: string;
}

export class StreamMessageDto {
  @ApiProperty({
    description: 'The unique identifier for the chat session.',
    example: 'session-12345',
  })
  sessionId: string;

  @ApiProperty({
    description: 'The user message to send to the chatbot.',
    example: 'Hello, who are you?',
  })
  message: string;

  @ApiProperty({
    description: '(Optional) The IP address of the user for metadata purposes.',
    required: false,
    example: '192.168.1.1',
  })
  metadataIp?: string;

  @ApiProperty({
    description:
      '(Optional) The device information of the user for metadata purposes.',
    required: false,
    example: 'Chrome on macOS',
  })
  metadataDevice?: string;
}

class ChatMessageDto {
  @ApiProperty({
    description: 'The role of the message sender.',
    example: 'user',
    enum: ['user', 'assistant', 'system'],
  })
  role: string;

  @ApiProperty({
    description: 'The content of the message.',
    example: 'What is the weather like?',
  })
  content: string;

  @ApiProperty({
    description: 'The ISO 8601 timestamp of when the message was created.',
    example: '2025-12-23T10:00:00.000Z',
  })
  createdAt: string;
}

export class ChatHistoryResponseDto {
  @ApiProperty({
    description:
      'An array of chat messages representing the conversation history.',
    type: [ChatMessageDto],
  })
  history: ChatMessageDto[];
}

export class NewSessionResponseDto {
  @ApiProperty({
    description: 'The unique identifier for the newly created chat session.',
    example: 'new-session-67890',
  })
  sessionId: string;
}
