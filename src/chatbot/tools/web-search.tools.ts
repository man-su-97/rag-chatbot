import { z } from 'zod';

export const webSearchParamsSchema = z.object({
  query: z
    .string()
    .describe('The search query to find information on the web.'),
});
