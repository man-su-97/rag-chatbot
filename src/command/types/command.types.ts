export type ChartType = 'line' | 'bar' | 'pie' | 'table';

export interface AddWidgetPayload {
  widgetId: string;
  chartType: ChartType;
}

export interface AddWidgetCommand {
  type: 'ADD_WIDGET';
  payload: AddWidgetPayload;
}

export type FrontendCommand = AddWidgetCommand;
