import { Injectable } from '@nestjs/common';
import { ChatMessage } from 'src/chatbot/types';
import { db } from 'src/database/drizzle-client';
import { conversation } from 'src/database/schema/conversation.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleMemoryService {
  async loadMemory(sessionId: string): Promise<ChatMessage[]> {
    const row = await db
      .select()
      .from(conversation)
      .where(eq(conversation.sessionId, sessionId))
      .limit(1);

    return (row[0]?.messages as ChatMessage[]) ?? [];
  }

  async saveMemory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const exists = await db
      .select()
      .from(conversation)
      .where(eq(conversation.sessionId, sessionId))
      .limit(1);

    if (exists.length === 0) {
      await db.insert(conversation).values({
        id: crypto.randomUUID(),
        sessionId,
        messages,
      });
    } else {
      await db
        .update(conversation)
        .set({ messages })
        .where(eq(conversation.sessionId, sessionId));
    }
  }
}
