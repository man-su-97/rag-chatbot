import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';

import { dashboardToolSchema } from './dashboard.tools';
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
          return text;
        },
      }),

      new DynamicStructuredTool({
        name: 'dashboard',
        description: `Manages dashboard widgets. Use this tool to add, update, delete, or list widgets. 
        The user will be prompted for any missing required parameters.`,
        schema: dashboardToolSchema,
        func: async () => '',
      }),
    ];
  }
}
