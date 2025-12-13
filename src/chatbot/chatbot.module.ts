import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { DatabaseModule } from 'src/database/database.module';
import { DrizzleMemoryService } from 'src/memory/drizzle-memory.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    {
      provide: 'MEMORY_BACKEND',
      useClass: DrizzleMemoryService,
    },
  ],
})
export class ChatbotModule {}
