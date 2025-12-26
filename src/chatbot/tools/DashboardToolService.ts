import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';

import {
  addWidgetParamsSchema,
  deleteWidgetParamsSchema,
  updateWidgetParamsSchema,
} from './dashboard.tools';
import { webSearchParamsSchema } from './web-search.tools';

@Injectable()
export class DashboardToolService {
  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'web-search',
        description: 'Fetch web content for up-to-date information using HTTP.',
        schema: webSearchParamsSchema,
        func: async (params) => {
          const url = `https://www.google.com/search?q=${encodeURIComponent(
            params.query,
          )}`;

          const res = await fetch(url);
          const text = await res.text();

          return JSON.stringify({
            tool: 'web-search',
            action: 'search',
            query: params.query,
            results: text,
          });
        },
      }),

      new DynamicStructuredTool({
        name: 'add-dashboard-widget',
        description: "Add a new widget to the user's dashboard.",
        schema: addWidgetParamsSchema,
        func: async (params) =>
          JSON.stringify({
            tool: 'dashboard',
            action: 'add_widget',
            params,
          }),
      }),

      new DynamicStructuredTool({
        name: 'delete-dashboard-widget',
        description: 'Delete a widget by its ID.',
        schema: deleteWidgetParamsSchema,
        func: async (params) =>
          JSON.stringify({
            tool: 'dashboard',
            action: 'delete_widget',
            params,
          }),
      }),

      new DynamicStructuredTool({
        name: 'update-dashboard-widget',
        description: 'Update an existing widget by its ID.',
        schema: updateWidgetParamsSchema,
        func: async (params) =>
          JSON.stringify({
            tool: 'dashboard',
            action: 'update_widget',
            params,
          }),
      }),
    ];
  }
}
