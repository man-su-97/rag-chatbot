import { ChatMessage } from '../types';

export class ChatResponseDto {
  sessionId!: string;
  reply?: string | null;
  messages!: ChatMessage[];
  streamed?: boolean;
}
