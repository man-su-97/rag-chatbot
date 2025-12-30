import { Injectable } from '@nestjs/common';
import { db } from 'src/database/drizzle-client';
import { conversation } from 'src/database/schema/conversation.schema';
import { eq } from 'drizzle-orm';
import { IMemoryBackend } from './memory-backend.interface';
import { BaseMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';
import { hydrateMessages } from 'src/chatbot/utils/message-mapper';

@Injectable()
export class DrizzleMemoryService implements IMemoryBackend {
  async loadMemory(sessionId: string): Promise<BaseMessage[]> {
    const row = await db
      .select()
      .from(conversation)
      .where(eq(conversation.sessionId, sessionId))
      .limit(1);

    if (!row.length || !row[0].messages) {
      return [];
    }

    // Previously, this was trying to deserialize, which is incorrect for plain JSON.
    // Now, we hydrate the plain objects into proper BaseMessage instances.
    return hydrateMessages(
      row[0].messages as { role: string; content: string }[],
    );
  }

  async saveMemory(sessionId: string, messages: BaseMessage[]): Promise<void> {
    const serializedMessages = messages.map((msg) => msg.toJSON());

    const exists = await db
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.sessionId, sessionId))
      .limit(1);

    if (exists.length === 0) {
      await db.insert(conversation).values({
        id: randomUUID(),
        sessionId,
        messages: serializedMessages,
      });
    } else {
      await db
        .update(conversation)
        .set({ messages: serializedMessages })
        .where(eq(conversation.sessionId, sessionId));
    }
  }
}
