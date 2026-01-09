import { z } from 'zod';

export const dashboardToolSchema = z.object({
  action: z
    .enum([
      'add_widget',
      'update_widget',
      'delete_widget',
      'list_widgets',
      'list_analytics',
    ])
    .describe('The specific dashboard action to perform.'),

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
