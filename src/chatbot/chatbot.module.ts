import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { InMemoryBackend } from 'src/memory/in-memory-backend';
import { ChatbotController } from './chatbot.controller';

@Module({
  providers: [
    ChatbotService,
    {
      provide: 'MEMORY_BACKEND',
      useClass: InMemoryBackend,
    },
  ],
  controllers: [ChatbotController],
})
export class ChatbotModule {}
