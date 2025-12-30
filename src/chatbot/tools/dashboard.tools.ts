import { z } from 'zod';

/**
 * This is the new, flat, Gemini-compatible schema for the dashboard tool.
 * It replaces the complex nested structure with a single object where all
 * possible parameters for all actions are optional at the top level.
 *
 * This simpler structure is fully supported by Google's Generative AI
 * function calling and relies on the new detailed system prompt to guide the
 * LLM in selecting the correct parameters for a given `action`.
 */
export const dashboardToolSchema = z.object({
  action: z
    .enum(['add_widget', 'update_widget', 'delete_widget', 'list_widgets'])
    .describe('The specific dashboard action to perform.'),

  // A flattened union of all possible fields from all actions, all optional.
  // The system prompt is now responsible for telling the LLM which are required for each action.
  id: z
    .string()
    .optional()
    .describe(
      'The unique ID of the widget. Required for "update_widget" and "delete_widget".',
    ),
  name: z
    .string()
    .optional()
    .describe('The name of the widget. Required for "add_widget".'),
  analytics_id: z
    .string()
    .optional()
    .describe('The analytics data source ID. Required for "add_widget".'),
  chart: z
    .enum(['line', 'bar', 'pie'])
    .optional()
    .describe(
      'The chart type. Required for "add_widget", optional for "update_widget".',
    ),
  stats_type: z
    .enum(['total', 'average'])
    .optional()
    .describe(
      'The statistic type. Required for "add_widget", optional for "update_widget".',
    ),
  x_axis: z
    .string()
    .optional()
    .describe(
      'The x-axis metric. Required for "add_widget", optional for "update_widget".',
    ),
  y_axis: z
    .string()
    .optional()
    .describe(
      'The y-axis metric. Required for "add_widget", optional for "update_widget".',
    ),
});
