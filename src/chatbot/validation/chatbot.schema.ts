import { z } from 'zod';

export const ChatbotSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),

  metadataIp: z.string().optional(),
  metadataDevice: z.string().optional(),
});
