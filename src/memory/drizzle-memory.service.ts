import { Injectable } from '@nestjs/common';
import { db } from 'src/database/drizzle-client';
import { conversation } from 'src/database/schema/conversation.schema';
import { eq } from 'drizzle-orm';
import { IMemoryBackend } from './memory-backend.interface';
import { BaseMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';
import { hydrateMessages } from 'src/chatbot/utils/message-mapper';
import { LangChainMessage, SerializedMessage } from 'src/chatbot/types';

@Injectable()
export class DrizzleMemoryService implements IMemoryBackend {
  async loadMemory(sessionId: string): Promise<BaseMessage[]> {
    try {
      console.log('Loading memory for session:', sessionId);

      const row = await db
        .select()
        .from(conversation)
        .where(eq(conversation.sessionId, sessionId))
        .limit(1);

      if (!row.length || !row[0].messages) {
        console.log('No existing conversation found');
        return [];
      }

      console.log('Raw messages from DB:', row[0].messages.length);

      const hydrated = hydrateMessages(row[0].messages);

      console.log('Hydrated messages:', hydrated.length);

      return hydrated;
    } catch (error) {
      console.error('Error loading memory:', error);
      return [];
    }
  }

  async saveMemory(sessionId: string, messages: BaseMessage[]): Promise<void> {
    try {
      console.log(
        'Saving',
        messages.length,
        'messages for session:',
        sessionId,
      );

      const serializedMessages = messages.map((msg) => {
        const json = msg.toJSON() as LangChainMessage;

        if (json.type === 'ai' && !json.kwargs?.additional_kwargs) {
          json.kwargs = {
            ...json.kwargs,
            additional_kwargs: {},
          };
        }

        return json;
      }) as SerializedMessage[];

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
        console.log('Created new conversation');
      } else {
        await db
          .update(conversation)
          .set({ messages: serializedMessages })
          .where(eq(conversation.sessionId, sessionId));
        console.log('Updated existing conversation');
      }
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  }
}
