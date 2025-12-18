import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  addWidgetParamsSchema,
  deleteWidgetParamsSchema,
  updateWidgetParamsSchema,
} from './dashboard.tools';

@Injectable()
export class DashboardToolService {
  getTools(): DynamicStructuredTool[] {
    return [
      new DynamicStructuredTool({
        name: 'add-dashboard-widget',
        description: "Call this to add a new widget to the user's dashboard.",
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
        description: 'Call this to delete a widget by its ID.',
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
        description: 'Call this to update an existing widget by its ID.',
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
