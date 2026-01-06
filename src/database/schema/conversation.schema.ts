import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { SerializedMessage } from 'src/chatbot/types';

export const conversation = pgTable('conversation', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  messages: jsonb('messages').$type<SerializedMessage[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
