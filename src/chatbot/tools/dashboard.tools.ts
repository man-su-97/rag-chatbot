import { z } from 'zod';

export const addWidgetParamsSchema = z.object({
  name: z.string().describe('The descriptive name for the new widget.'),
  chart: z
    .enum(['bar_chart', 'line_chart', 'pie_chart', 'table_chart'])
    .describe('The type of chart for the widget.'),
  parameter: z
    .string()
    .optional()
    .describe('The primary parameter or metric for the widget.'),
  analytics_id: z
    .string()
    .optional()
    .describe('The ID linking to a more detailed analytics view.'),
  stats_type: z
    .string()
    .optional()
    .describe('The type of statistic the widget displays.'),
});

export const deleteWidgetParamsSchema = z.object({
  id: z.string().describe('The ID of the widget to be deleted.'),
});

export const updateWidgetParamsSchema = z.object({
  id: z.string().describe('The ID of the widget to update.'),
  name: z.string().optional().describe('The new name for the widget.'),

  chart: z
    .enum(['bar_chart', 'line_chart', 'pie_chart', 'table_chart'])
    .optional(),
  x_axis: z.string().optional(),
  y_axis: z.string().optional(),
});
